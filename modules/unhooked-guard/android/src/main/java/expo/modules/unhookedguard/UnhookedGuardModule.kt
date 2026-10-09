package expo.modules.unhookedguard

import android.app.AppOpsManager
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
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.provider.Telephony
import android.telecom.TelecomManager
import android.util.Base64
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
