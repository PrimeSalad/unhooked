package expo.modules.unhookedguard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import java.util.Calendar

/**
 * Watches which app comes to the front (Usage access, user-granted) once a second while the
 * screen is on. When a guarded app opens inside its schedule or an Unhook timer, it shows
 * Unhooked's pause screen. Nothing is logged or sent anywhere.
 */
class AppGuardService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var lastShieldPkg: String? = null
  private var lastShieldAt = 0L

  private val tick = object : Runnable {
    override fun run() {
      runCatching { check() }
      handler.postDelayed(this, 1000)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      handler.removeCallbacks(tick)
      stopForegroundCompat()
      stopSelf()
      return START_NOT_STICKY
    }
    startForegroundCompat()
    handler.removeCallbacks(tick)
    handler.post(tick)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    super.onDestroy()
  }

  private fun check() {
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    if (!power.isInteractive) return
    val pkg = foregroundPackage() ?: return
    if (pkg == packageName) return
    val cfg = GuardStore.config(this) ?: return
    val apps = cfg.optJSONArray("apps") ?: return
    val now = System.currentTimeMillis()
    val timerOn = cfg.optLong("timerUntilMs", 0L) > now

    for (i in 0 until apps.length()) {
      val app = apps.getJSONObject(i)
      if (app.optString("packageName") != pkg) continue
      val active = timerOn || inSchedule(app.optInt("start", -1), app.optInt("end", -1))
      if (!active || GuardStore.allowedUntil(this, pkg) > now) return
      if (pkg == lastShieldPkg && now - lastShieldAt < 4000) return
      lastShieldPkg = pkg
      lastShieldAt = now
      launchShield(pkg, app.optString("label", pkg), app.optString("mode", "pause"), timerOn)
      return
    }
  }

  @Suppress("DEPRECATION")
  private fun foregroundPackage(): String? {
    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val events = usm.queryEvents(end - 10_000, end)
    val e = UsageEvents.Event()
    var last: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      // MOVE_TO_FOREGROUND == ACTIVITY_RESUMED (1) on every API level.
      if (e.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) last = e.packageName
    }
    return last
  }

  private fun inSchedule(start: Int, end: Int): Boolean {
    if (start < 0 || end < 0 || start == end) return true
    val c = Calendar.getInstance()
    val m = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE)
    return if (start < end) m in start until end else m >= start || m < end
  }

  private fun launchShield(pkg: String, label: String, mode: String, timer: Boolean) {
    val uri = Uri.Builder()
      .scheme(SHIELD_SCHEME)
      .authority("shield")
      .appendQueryParameter("pkg", pkg)
      .appendQueryParameter("label", label)
      .appendQueryParameter("mode", mode)
      .appendQueryParameter("timer", if (timer) "1" else "0")
      .build()
    val intent = Intent(Intent.ACTION_VIEW, uri)
      .setPackage(packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    runCatching { startActivity(intent) }
  }

  private fun startForegroundCompat() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, "Unhooked guard", NotificationManager.IMPORTANCE_MIN).apply {
          setShowBadge(false)
        },
      )
    }
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL)
      else @Suppress("DEPRECATION") Notification.Builder(this)
    // Discreet on purpose: lock screens are public. Never mention debt or what is guarded.
    val notification = builder
      .setContentTitle("Unhooked is on")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .build()
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
    else @Suppress("DEPRECATION") stopForeground(true)
  }

  companion object {
    const val ACTION_STOP = "expo.modules.unhookedguard.STOP_APP_GUARD"
    const val SHIELD_SCHEME = "unhooked"
    private const val CHANNEL = "unhooked_guard"
    private const val NOTIFICATION_ID = 4210
  }
}
