package expo.modules.unhookedguard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import org.json.JSONObject
import java.util.Calendar

/**
 * Watches which app is in front (Usage access, user-granted) once a second while the screen is on.
 *  - Opening a guarded app inside its schedule or an Unhook timer → Unhooked's pause screen.
 *  - Staying in a guarded app past the "doomscroll fade" limit → one gentle check-in notification
 *    and a white wash that slowly fades in over the screen. Touches pass through: never a lock.
 * Nothing is logged or sent anywhere.
 */
class AppGuardService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var lastShieldPkg: String? = null
  private var lastShieldAt = 0L

  // Continuous foreground tracking from usage events.
  private var lastQueryAt = 0L
  private var currentPkg: String? = null
  private var currentSince = 0L
  private var nudgedPkgSession: String? = null
  private var lastBackgroundPkg: String? = null
  private var lastBackgroundAt = 0L
  private var lastBackgroundSince = 0L

  private var wash: View? = null

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
      removeWash()
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
    removeWash()
    super.onDestroy()
  }

  private fun check() {
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    if (!power.isInteractive) {
      removeWash()
      currentPkg = null
      return
    }
    val changedTo = updateForeground()
    val cfg = GuardStore.config(this) ?: return removeWash()
    val now = System.currentTimeMillis()
    val pkg = currentPkg
    val app = pkg?.let { findApp(cfg, it) }

    if (app == null || pkg == packageName) {
      removeWash()
      return
    }

    // 1) Shield on open (only when the app just came to the front).
    if (changedTo == pkg) {
      val timerOn = cfg.optLong("timerUntilMs", 0L) > now
      val active = timerOn || inSchedule(app.optInt("start", -1), app.optInt("end", -1))
      val allowed = GuardStore.allowedUntil(this, pkg) > now
      val recent = pkg == lastShieldPkg && now - lastShieldAt < 4000
      if (active && !allowed && !recent) {
        lastShieldPkg = pkg
        lastShieldAt = now
        launchShield(pkg, app.optString("label", pkg), app.optString("mode", "pause"), timerOn)
        return
      }
    }

    // 2) Doomscroll fade: long continuous use of a guarded app.
    val fadeAfterMs = cfg.optInt("fadeAfterMin", 0) * 60_000L
    if (fadeAfterMs <= 0) return removeWash()
    val stayed = now - currentSince
    if (stayed < fadeAfterMs) return removeWash()

    val label = app.optString("label", pkg)
    if (nudgedPkgSession != "$pkg@$currentSince") {
      nudgedPkgSession = "$pkg@$currentSince"
      notifyCheckIn(label, (stayed / 60_000L).toInt())
    }
    // +5% white every 15 s after the limit, from 15% up to 85%.
    val steps = ((stayed - fadeAfterMs) / 15_000L).toInt()
    showWash((0.15f + 0.05f * steps).coerceAtMost(0.85f))
  }

  /** Reads new usage events since the last tick. Returns the package that just came to the front. */
  @Suppress("DEPRECATION")
  private fun updateForeground(): String? {
    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val start = if (lastQueryAt == 0L) end - 10_000 else lastQueryAt
    lastQueryAt = end
    val events = usm.queryEvents(start, end)
    val e = UsageEvents.Event()
    var changedTo: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      when (e.eventType) {
        // MOVE_TO_FOREGROUND == ACTIVITY_RESUMED (1); MOVE_TO_BACKGROUND == ACTIVITY_PAUSED (2).
        UsageEvents.Event.MOVE_TO_FOREGROUND -> {
          val sameAppBlip = e.packageName == lastBackgroundPkg && e.timeStamp - lastBackgroundAt < 2000
          if (sameAppBlip) {
            // Quick pause→resume inside the same app (dialogs, rotation): keep the session going.
            currentPkg = e.packageName
            currentSince = lastBackgroundSince
          } else if (e.packageName != currentPkg) {
            currentPkg = e.packageName
            currentSince = e.timeStamp
            changedTo = e.packageName
          }
        }
        UsageEvents.Event.MOVE_TO_BACKGROUND -> {
          if (e.packageName == currentPkg) {
            lastBackgroundPkg = e.packageName
            lastBackgroundAt = e.timeStamp
            lastBackgroundSince = currentSince
            currentPkg = null
          }
        }
      }
    }
    return changedTo
  }

  private fun findApp(cfg: JSONObject, pkg: String): JSONObject? {
    val apps = cfg.optJSONArray("apps") ?: return null
    for (i in 0 until apps.length()) {
      val app = apps.getJSONObject(i)
      if (app.optString("packageName") == pkg) return app
    }
    return null
  }

  private fun inSchedule(start: Int, end: Int): Boolean {
    if (start < 0 || end < 0 || start == end) return true
    val c = Calendar.getInstance()
    val m = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE)
    return if (start < end) m in start until end else m >= start || m < end
  }

  private fun launchShield(pkg: String, label: String, mode: String, timer: Boolean) {
    removeWash()
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

  // ---------- doomscroll fade ----------

  private fun showWash(alpha: Float) {
    if (!Settings.canDrawOverlays(this)) return
    val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val view = wash ?: View(this).also { v ->
      v.setBackgroundColor(Color.WHITE)
      v.alpha = 0f
      val type =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
      val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT,
      )
      runCatching { wm.addView(v, params) }.onFailure { return }
      wash = v
    }
    view.animate().alpha(alpha).setDuration(1200).start()
  }

  private fun removeWash() {
    val view = wash ?: return
    wash = null
    val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    runCatching { wm.removeView(view) }
  }

  private fun notifyCheckIn(label: String, minutes: Int) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHECKIN_CHANNEL, "Scroll check-ins", NotificationManager.IMPORTANCE_HIGH),
      )
    }
    val open = PendingIntent.getActivity(
      this,
      0,
      Intent(Intent.ACTION_VIEW, Uri.parse("$SHIELD_SCHEME://scroll")).setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHECKIN_CHANNEL)
      else @Suppress("DEPRECATION") Notification.Builder(this)
    val n = builder
      .setContentTitle("Still scrolling on purpose?")
      .setContentText("$label · $minutes min. Your screen will slowly fade.")
      .setSmallIcon(applicationInfo.icon)
      .setContentIntent(open)
      .setAutoCancel(true)
      .build()
    runCatching { manager.notify(CHECKIN_ID, n) }
  }

  // ---------- foreground service ----------

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
    private const val CHECKIN_CHANNEL = "unhooked_checkins"
    private const val NOTIFICATION_ID = 4210
    private const val CHECKIN_ID = 4212
  }
}
