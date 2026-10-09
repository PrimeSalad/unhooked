package expo.modules.unhookedguard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject

/**
 * Runs only after the user makes Unhooked the phone's call screening app. Sees the caller's
 * number, never the call audio. Flags a call when the number is in the user's number log or
 * called 3+ times within an hour; only numbers in the log are ever silenced or declined.
 * Must answer within a few seconds, so this is rules only: no model, no network.
 */
class CollectorScreeningService : CallScreeningService() {
  override fun onScreenCall(details: Call.Details) {
    val allow = CallResponse.Builder().build()
    val incoming =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        details.callDirection == Call.Details.DIRECTION_INCOMING
    val mode = CallStore.mode(this)
    val number = CallStore.normalize(details.handle?.schemeSpecificPart)
    if (!incoming || mode == "off" || number == null) {
      respondToCall(details, allow)
      return
    }

    val now = System.currentTimeMillis()
    val calls = CallStore.countCall(this, number, now)
    val entry = CallStore.lookup(this, number)
    if (entry == null && calls < CallStore.REPEAT_CALLS) {
      respondToCall(details, allow)
      return
    }

    // A blocked number is always declined. A repeated unknown caller is only ever flagged:
    // it could be family in an emergency.
    val action = when {
      entry?.block == true -> "reject"
      entry == null -> "notify"
      else -> mode
    }
    val response = CallResponse.Builder().apply {
      if (action == "reject") {
        setDisallowCall(true)
        setRejectCall(true)
      } else if (action == "silence" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        setSilenceCall(true)
      }
    }.build()
    respondToCall(details, response)

    CallStore.addFlagged(
      this,
      JSONObject()
        .put("number", number)
        .put("label", entry?.label ?: JSONObject.NULL)
        .put("reports", entry?.reports ?: 0)
        .put("blocked", entry?.block == true)
        .put("callsLastHour", calls)
        .put("at", iso(now))
        .put("action", action),
    )
    notifyFlagged(number, entry, calls, action, now)
  }

  private fun notifyFlagged(number: String, entry: CallStore.Entry?, calls: Int, action: String, now: Long) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, "Possible collector calls", NotificationManager.IMPORTANCE_DEFAULT),
      )
    }
    val reasons = buildList {
      if (entry?.block == true) add("Blocked by you")
      if (entry != null && entry.reports > 0) add("In your number log (${entry.reports}×)")
      if (calls >= CallStore.REPEAT_CALLS) add("$calls calls in an hour")
      val hour = Calendar.getInstance().apply { timeInMillis = now }.get(Calendar.HOUR_OF_DAY)
      if (hour < 6 || hour >= 22) add("Before 6 AM or after 10 PM")
    }
    val handled = when (action) {
      "reject" -> if (entry?.block == true) "Blocked" else "Declined"
      "silence" -> "Silenced"
      else -> "Possible collector"
    }
    val open = PendingIntent.getActivity(
      this,
      0,
      Intent(Intent.ACTION_VIEW, Uri.parse("unhooked://calls")).setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL)
      else @Suppress("DEPRECATION") Notification.Builder(this)
    val n = builder
      .setContentTitle("$handled · ${entry?.label ?: number}")
      .setContentText(reasons.joinToString(" · "))
      .setSmallIcon(applicationInfo.icon)
      .setContentIntent(open)
      .setAutoCancel(true)
      .build()
    runCatching { manager.notify(NOTIFICATION_ID, n) }
  }

  private fun iso(ms: Long): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
      .apply { timeZone = TimeZone.getTimeZone("UTC") }
      .format(Date(ms))

  private companion object {
    const val CHANNEL = "unhooked_collector_calls"
    const val NOTIFICATION_ID = 4231
  }
}
