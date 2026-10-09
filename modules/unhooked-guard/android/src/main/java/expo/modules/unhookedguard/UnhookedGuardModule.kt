package expo.modules.unhookedguard

import android.app.Activity
import android.app.AppOpsManager
import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.net.Uri
import android.net.VpnService
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.provider.Telephony
import android.telecom.TelecomManager
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

// Phase 4B step 1: installed-app list + permission checks. Everything stays on the device;
// nothing here logs or sends the app list anywhere.
class UnhookedGuardModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("UnhookedGuard")

    AsyncFunction("getLaunchableApps") { includeIcons: Boolean ->
      launchableApps(includeIcons)
    }

    Function("hasUsageAccess") { hasUsageAccess() }

    Function("canDrawOverlays") { Settings.canDrawOverlays(context) }

    Function("openUsageAccessSettings") {
      openSettings(Settings.ACTION_USAGE_ACCESS_SETTINGS)
    }

    Function("openOverlaySettings") {
      openSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
    }

    // Phase 4B steps 2–3: app guard service, "open anyway" allowance, local DNS web guard.
    Function("startAppGuard") { configJson: String ->
      GuardStore.saveConfig(context, configJson)
      val intent = Intent(context, AppGuardService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
    }

    Function("stopAppGuard") {
      GuardStore.clearConfig(context)
      context.startService(Intent(context, AppGuardService::class.java).setAction(AppGuardService.ACTION_STOP))
    }

    Function("allowApp") { packageName: String, minutes: Int ->
      GuardStore.allow(context, packageName, System.currentTimeMillis() + minutes * 60_000L)
      openApp(packageName)
    }

    Function("goHome") {
      context.startActivity(
        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    Function("isWebGuardPrepared") { VpnService.prepare(context) == null }

    AsyncFunction("prepareWebGuard") { promise: Promise ->
      val consent = VpnService.prepare(context)
      if (consent == null) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      pendingVpnConsent = promise
      activity.startActivityForResult(consent, VPN_REQUEST)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == VPN_REQUEST) {
        pendingVpnConsent?.resolve(payload.resultCode == Activity.RESULT_OK)
        pendingVpnConsent = null
      }
      if (payload.requestCode == CALL_SCREEN_REQUEST) {
        pendingCallScreenRole?.resolve(holdsCallScreeningRole())
        pendingCallScreenRole = null
      }
    }

    // ---------- collector call screening ----------

    Function("isCallScreeningAvailable") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
        roleManager()?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true
    }

    Function("hasCallScreeningRole") { holdsCallScreeningRole() }

    /** Shows Android's own "set as call screening app" dialog. Call after the in-app disclosure. */
    AsyncFunction("requestCallScreeningRole") { promise: Promise ->
      val roles = roleManager()
      val activity = appContext.currentActivity
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || roles == null || activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      if (roles.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
        promise.resolve(true)
        return@AsyncFunction
      }
      pendingCallScreenRole = promise
      activity.startActivityForResult(
        roles.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING),
        CALL_SCREEN_REQUEST,
      )
    }

    Function("configureCallScreening") { numbersJson: String, mode: String ->
      require(mode in listOf("off", "notify", "silence", "reject")) { "Unknown call screening mode." }
      CallStore.configure(context, numbersJson, mode)
    }

    Function("takeScreenedCalls") { CallStore.takeFlagged(context) }

    // ---------- "Share to Unhooked" from Messages (no READ_SMS) ----------

    Events("onSharedText")

    /** Text shared into the app when it was opened from the share sheet; consumed once. */
    Function("takeSharedText") {
      val activity = appContext.currentActivity ?: return@Function null
      val text = sharedText(activity.intent)
      if (text != null) activity.intent = Intent()
      text
    }

    OnNewIntent { intent ->
      sharedText(intent)?.let { sendEvent("onSharedText", mapOf("text" to it)) }
    }

    Function("startWebGuard") { domainsJson: String ->
      val arr = org.json.JSONArray(domainsJson)
      GuardStore.saveDomains(context, (0 until arr.length()).map { arr.getString(it) })
      if (VpnService.prepare(context) == null) {
        context.startService(Intent(context, WebGuardVpnService::class.java))
      }
    }

    Function("stopWebGuard") {
      GuardStore.saveDomains(context, emptyList())
      context.startService(Intent(context, WebGuardVpnService::class.java).setAction(WebGuardVpnService.ACTION_STOP))
    }
  }

  private var pendingVpnConsent: Promise? = null
  private var pendingCallScreenRole: Promise? = null

  private fun roleManager(): RoleManager? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) context.getSystemService(RoleManager::class.java) else null

  private fun holdsCallScreeningRole(): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      roleManager()?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true

  private fun sharedText(intent: Intent?): String? {
    if (intent?.action != Intent.ACTION_SEND || intent.type?.startsWith("text/") != true) return null
    return intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()?.takeIf { it.isNotEmpty() }?.take(5_000)
  }

  private fun openApp(packageName: String) {
    val launch = context.packageManager.getLaunchIntentForPackage(packageName) ?: return
    context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  private fun launchableApps(includeIcons: Boolean): List<Map<String, Any?>> {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val resolved: List<ResolveInfo> =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0L))
      } else {
        @Suppress("DEPRECATION")
        pm.queryIntentActivities(intent, 0)
      }
    val essential = essentialPackages()

    return resolved
      .map { it.activityInfo.applicationInfo }
      .distinctBy { it.packageName }
      .filter { it.packageName != context.packageName }
      .map { info ->
        mapOf(
          "packageName" to info.packageName,
          "label" to info.loadLabel(pm).toString(),
          "iconBase64" to if (includeIcons) iconBase64(info.loadIcon(pm)) else null,
          "category" to categoryName(info),
          "isEssential" to (info.packageName in essential),
        )
      }
  }

  private companion object {
    const val VPN_REQUEST = 4211
    const val CALL_SCREEN_REQUEST = 4212
  }

  /** Apps that must never be guarded: calling, texting and system Settings. */
  private fun essentialPackages(): Set<String> {
    val result = mutableSetOf("com.android.settings")
    val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
    telecom?.defaultDialerPackage?.let { result.add(it) }
    Telephony.Sms.getDefaultSmsPackage(context)?.let { result.add(it) }
    return result
  }

  private fun categoryName(info: ApplicationInfo): String =
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      "other"
    } else {
      when (info.category) {
        ApplicationInfo.CATEGORY_SOCIAL -> "social"
        ApplicationInfo.CATEGORY_VIDEO -> "video"
        ApplicationInfo.CATEGORY_GAME -> "game"
        ApplicationInfo.CATEGORY_AUDIO -> "audio"
        ApplicationInfo.CATEGORY_IMAGE -> "image"
        ApplicationInfo.CATEGORY_NEWS -> "news"
        ApplicationInfo.CATEGORY_MAPS -> "maps"
        ApplicationInfo.CATEGORY_PRODUCTIVITY -> "productivity"
        else -> "other"
      }
    }

  private fun iconBase64(drawable: Drawable, sizePx: Int = 96): String {
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val icon = drawable.mutate()
    icon.setBounds(0, 0, sizePx, sizePx)
    icon.draw(Canvas(bitmap))
    val out = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
    bitmap.recycle()
    return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
      }
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
        PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  /** Opens this app's page for the setting; falls back to the general list on phones without one. */
  private fun openSettings(action: String) {
    val packageUri = Uri.parse("package:${context.packageName}")
    try {
      context.startActivity(Intent(action, packageUri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
      context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
