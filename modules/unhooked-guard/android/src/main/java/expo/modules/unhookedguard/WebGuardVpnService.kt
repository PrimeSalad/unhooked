package expo.modules.unhookedguard

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Local, DNS-only "VPN". Only DNS lookups are routed here: lookups for the user's listed
 * domains get "no such host", everything else is forwarded to a public resolver and the
 * answer is passed straight back. No other traffic enters this service, nothing is logged,
 * and no remote server of ours is involved.
 */
class WebGuardVpnService : VpnService() {
  private var tun: ParcelFileDescriptor? = null
  private var reader: Thread? = null
  private var pool: ExecutorService? = null
  private var out: FileOutputStream? = null
  @Volatile private var running = false
  @Volatile private var domains: Set<String> = emptySet()

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      shutdown()
      stopSelf()
      return START_NOT_STICKY
    }
    domains = GuardStore.domains(this)
    if (!running) startTunnel()
    return START_STICKY
  }

  override fun onRevoke() {
    shutdown()
    super.onRevoke()
  }

  override fun onDestroy() {
    shutdown()
    super.onDestroy()
  }

  private fun startTunnel() {
    val builder = Builder()
      .setSession("Unhooked web guard")
      .addAddress(TUN_ADDRESS, 32)
      .addDnsServer(FAKE_DNS)
      .addRoute(FAKE_DNS, 32)
      .setBlocking(true)
    runCatching { builder.addDisallowedApplication(packageName) }
    val fd = builder.establish() ?: return
    tun = fd
    out = FileOutputStream(fd.fileDescriptor)
    pool = Executors.newFixedThreadPool(4)
    running = true
    reader = Thread({ readLoop(FileInputStream(fd.fileDescriptor)) }, "unhooked-dns").also { it.start() }
  }

  private fun shutdown() {
    running = false
    reader?.interrupt()
    reader = null
    pool?.shutdownNow()
    pool = null
    runCatching { tun?.close() }
    tun = null
    out = null
  }

  private fun readLoop(input: FileInputStream) {
    val buf = ByteArray(32767)
    while (running) {
      val n = runCatching { input.read(buf) }.getOrDefault(-1)
      if (n <= 0) {
        if (!running) break
        continue
      }
      val packet = buf.copyOf(n)
      pool?.execute { runCatching { handle(packet) } }
    }
  }

  /** IPv4 + UDP to port 53 only; anything else is dropped (only DNS is routed here). */
  private fun handle(p: ByteArray) {
    if (p.size < 28 || (p[0].toInt() shr 4) != 4 || p[9].toInt() != 17) return
    val ihl = (p[0].toInt() and 0x0F) * 4
    val totalLen = u16(p, 2).coerceAtMost(p.size)
    if (ihl + 8 > totalLen || u16(p, ihl + 2) != 53) return
    val srcPort = u16(p, ihl)
    val query = p.copyOfRange(ihl + 8, totalLen)
    if (query.size < 12) return

    val host = questionName(query)
    val answer =
      if (host != null && isBlocked(host)) nxdomain(query) else forward(query) ?: return
    write(buildReply(p, ihl, srcPort, answer))
  }

  private fun isBlocked(host: String): Boolean {
    val h = host.lowercase().trimEnd('.')
    return domains.any { h == it || h.endsWith(".$it") }
  }

  private fun questionName(q: ByteArray): String? {
    val labels = mutableListOf<String>()
    var i = 12
    while (i < q.size) {
      val len = q[i].toInt() and 0xFF
      if (len == 0) return labels.joinToString(".")
      if (len and 0xC0 != 0 || i + 1 + len > q.size) return null
      labels.add(String(q, i + 1, len, Charsets.US_ASCII))
      i += 1 + len
    }
    return null
  }

  private fun nxdomain(q: ByteArray): ByteArray {
    val r = q.copyOf()
    r[2] = (0x80 or (q[2].toInt() and 0x01)).toByte() // QR=1, keep RD
    r[3] = 0x83.toByte() // RA=1, RCODE=3 (NXDOMAIN)
    r[6] = 0; r[7] = 0; r[8] = 0; r[9] = 0; r[10] = 0; r[11] = 0
    return r
  }

  private fun forward(q: ByteArray): ByteArray? {
    for (server in UPSTREAM) {
      val socket = DatagramSocket()
      try {
        protect(socket)
        socket.soTimeout = 4000
        socket.send(DatagramPacket(q, q.size, InetAddress.getByName(server), 53))
        val buf = ByteArray(4096)
        val resp = DatagramPacket(buf, buf.size)
        socket.receive(resp)
        return buf.copyOf(resp.length)
      } catch (_: Exception) {
        // try the next resolver
      } finally {
        socket.close()
      }
    }
    return null
  }

  /** Swap addresses/ports and wrap the DNS answer in fresh IPv4 + UDP headers. */
  private fun buildReply(req: ByteArray, ihl: Int, clientPort: Int, payload: ByteArray): ByteArray {
    val udpLen = 8 + payload.size
    val total = 20 + udpLen
    val r = ByteArray(total)
    r[0] = 0x45
    put16(r, 2, total)
    r[6] = 0x40 // don't fragment
    r[8] = 64
    r[9] = 17
    System.arraycopy(req, 16, r, 12, 4) // src = the fake DNS server
    System.arraycopy(req, 12, r, 16, 4) // dst = the asking app
    put16(r, 10, checksum(r, 0, 20))
    put16(r, 20, 53)
    put16(r, 22, clientPort)
    put16(r, 24, udpLen)
    // UDP checksum 0 = "not computed", valid for IPv4.
    System.arraycopy(payload, 0, r, 28, payload.size)
    return r
  }

  @Synchronized
  private fun write(packet: ByteArray) {
    runCatching { out?.write(packet) }
  }

  private fun u16(b: ByteArray, i: Int) = ((b[i].toInt() and 0xFF) shl 8) or (b[i + 1].toInt() and 0xFF)

  private fun put16(b: ByteArray, i: Int, v: Int) {
    b[i] = (v shr 8).toByte()
    b[i + 1] = v.toByte()
  }

  private fun checksum(b: ByteArray, off: Int, len: Int): Int {
    var sum = 0L
    var i = off
    while (i < off + len) {
      sum += u16(b, i)
      i += 2
    }
    while (sum shr 16 != 0L) sum = (sum and 0xFFFF) + (sum shr 16)
    return (sum.inv() and 0xFFFF).toInt()
  }

  companion object {
    const val ACTION_STOP = "expo.modules.unhookedguard.STOP_WEB_GUARD"
    private const val TUN_ADDRESS = "10.111.222.2"
    private const val FAKE_DNS = "10.111.222.1"
    private val UPSTREAM = listOf("1.1.1.1", "8.8.8.8")
  }
}
