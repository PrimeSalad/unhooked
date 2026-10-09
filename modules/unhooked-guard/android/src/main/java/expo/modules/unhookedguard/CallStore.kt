package expo.modules.unhookedguard

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Collector call screening state, kept on the device so the screening service works while the
 * app is closed. Only numbers from the user's own number log, recent call times (one hour) and
 * the flagged calls waiting to be saved as evidence. Rules mirror src/domain/callScreen.ts.
 */
object CallStore {
  private const val PREFS = "unhooked_calls"
  private const val KEY_NUMBERS = "numbers"
  private const val KEY_MODE = "mode"
  private const val KEY_RECENT = "recent"
  private const val KEY_FLAGGED = "flagged"
  private const val HOUR_MS = 60 * 60 * 1000L
  private const val MAX_FLAGGED = 100
  const val REPEAT_CALLS = 3

  data class Entry(val label: String, val reports: Int, val block: Boolean)

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** [{ number, label, reports, block }] from the number log and block list, plus the mode. */
  fun configure(ctx: Context, numbersJson: String, mode: String) {
    prefs(ctx).edit().putString(KEY_NUMBERS, numbersJson).putString(KEY_MODE, mode).apply()
  }

  fun mode(ctx: Context): String = prefs(ctx).getString(KEY_MODE, "off") ?: "off"

  fun lookup(ctx: Context, number: String): Entry? {
    val raw = prefs(ctx).getString(KEY_NUMBERS, null) ?: return null
    val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return null
    for (i in 0 until arr.length()) {
      val item = arr.optJSONObject(i) ?: continue
      if (item.optString("number") == number) {
        return Entry(
          item.optString("label", "Reported number"),
          item.optInt("reports", 1),
          item.optBoolean("block", false),
        )
      }
    }
    return null
  }

  /** Records this call and returns how many calls this number made in the last hour. */
  @Synchronized
  fun countCall(ctx: Context, number: String, now: Long): Int {
    val recent = runCatching { JSONObject(prefs(ctx).getString(KEY_RECENT, "{}")!!) }
      .getOrDefault(JSONObject())
    val pruned = JSONObject()
    for (key in recent.keys()) {
      val times = recent.optJSONArray(key) ?: continue
      val kept = JSONArray()
      for (i in 0 until times.length()) {
        val t = times.optLong(i)
        if (now - t < HOUR_MS) kept.put(t)
      }
      if (kept.length() > 0) pruned.put(key, kept)
    }
    val mine = pruned.optJSONArray(number) ?: JSONArray()
    mine.put(now)
    pruned.put(number, mine)
    prefs(ctx).edit().putString(KEY_RECENT, pruned.toString()).apply()
    return mine.length()
  }

  @Synchronized
  fun addFlagged(ctx: Context, call: JSONObject) {
    val list = runCatching { JSONArray(prefs(ctx).getString(KEY_FLAGGED, "[]")) }.getOrDefault(JSONArray())
    list.put(call)
    val trimmed = JSONArray()
    for (i in maxOf(0, list.length() - MAX_FLAGGED) until list.length()) trimmed.put(list.get(i))
    prefs(ctx).edit().putString(KEY_FLAGGED, trimmed.toString()).apply()
  }

  /** Flagged calls since the last time the app took them; the app saves them as evidence. */
  @Synchronized
  fun takeFlagged(ctx: Context): String {
    val raw = prefs(ctx).getString(KEY_FLAGGED, "[]") ?: "[]"
    prefs(ctx).edit().remove(KEY_FLAGGED).apply()
    return raw
  }

  /** Same as src/domain/numberLog.ts normalizeMobile: +639XXXXXXXXX or null. */
  fun normalize(raw: String?): String? {
    val digits = raw?.filter { it.isDigit() } ?: return null
    val local = when {
      digits.length == 12 && digits.startsWith("63") -> digits.substring(2)
      digits.length == 11 && digits.startsWith("0") -> digits.substring(1)
      else -> digits
    }
    return if (local.length == 10 && local.startsWith("9")) "+63$local" else null
  }
}
