package expo.modules.unhookedguard

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Guard config kept on the device so the services keep working when the JS app is closed. */
object GuardStore {
  private const val PREFS = "unhooked_guard"
  private const val KEY_CONFIG = "config"
  private const val KEY_DOMAINS = "domains"
  private const val ALLOW_PREFIX = "allow:"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveConfig(ctx: Context, json: String) = prefs(ctx).edit().putString(KEY_CONFIG, json).apply()

  fun config(ctx: Context): JSONObject? =
    prefs(ctx).getString(KEY_CONFIG, null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  fun clearConfig(ctx: Context) = prefs(ctx).edit().remove(KEY_CONFIG).apply()

  fun allow(ctx: Context, pkg: String, untilMs: Long) =
    prefs(ctx).edit().putLong(ALLOW_PREFIX + pkg, untilMs).apply()

  fun allowedUntil(ctx: Context, pkg: String): Long = prefs(ctx).getLong(ALLOW_PREFIX + pkg, 0L)

  fun saveDomains(ctx: Context, domains: List<String>) =
    prefs(ctx).edit().putString(KEY_DOMAINS, JSONArray(domains).toString()).apply()

  fun domains(ctx: Context): Set<String> {
    val raw = prefs(ctx).getString(KEY_DOMAINS, null) ?: return emptySet()
    val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return emptySet()
    return (0 until arr.length()).map { arr.getString(it).lowercase() }.toSet()
  }
}
