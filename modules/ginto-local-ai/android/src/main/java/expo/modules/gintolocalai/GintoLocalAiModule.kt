package expo.modules.gintolocalai

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** Android-only LiteRT-LM runtime. Each model tries NPU, then GPU, then CPU. */
class GintoLocalAiModule : Module() {
  private val runtimeLock = ReentrantLock()
  private var engine: Engine? = null
  private var conversation: Conversation? = null
  private var modelPath: String? = null
  private var activeBackend: String? = null
  private var backendNote: String? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("GintoLocalAi")

    AsyncFunction("inspectDevice") {
      inspectDevice()
    }

    AsyncFunction("getRuntimeStatus") {
      runtimeLock.withLock { runtimeStatus() }
    }

    AsyncFunction("startModel") { modelUri: String ->
      runtimeLock.withLock {
        initializeModel(modelUri)
        runtimeStatus()
      }
    }

    AsyncFunction("generate") { modelUri: String, prompt: String ->
      runtimeLock.withLock {
        initializeModel(modelUri)
        val answer = conversation?.sendMessage(prompt)?.toString()?.trim().orEmpty()
        if (answer.isBlank()) throw IllegalStateException("The local model returned an empty reply.")
        mapOf(
          "text" to answer,
          "backend" to activeBackend,
          "backendNote" to backendNote,
        )
      }
    }

    Function("closeModel") {
      runtimeLock.withLock { closeRuntime() }
    }

    OnDestroy {
      runtimeLock.withLock { closeRuntime() }
    }
  }

  private fun inspectDevice(): Map<String, Any?> {
    val memoryManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val memory = ActivityManager.MemoryInfo()
    memoryManager.getMemoryInfo(memory)

    val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val batteryPercent = if (level >= 0 && scale > 0) level * 100 / scale else null
    val batteryStatus = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val charging = batteryStatus == BatteryManager.BATTERY_STATUS_CHARGING ||
      batteryStatus == BatteryManager.BATTERY_STATUS_FULL

    val storage = StatFs(Environment.getDataDirectory().absolutePath)
    val status = runtimeLock.withLock { runtimeStatus() }

    return mapOf(
      "manufacturer" to Build.MANUFACTURER,
      "modelName" to Build.MODEL,
      "androidVersion" to Build.VERSION.RELEASE,
      "chipset" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Build.SOC_MODEL else Build.HARDWARE,
      "totalMemoryBytes" to memory.totalMem,
      "availableMemoryBytes" to memory.availMem,
      "lowMemory" to memory.lowMemory,
      "batteryPercent" to batteryPercent,
      "charging" to charging,
      "freeStorageBytes" to storage.availableBytes,
      "accelerator" to status["backend"],
      "acceleratorNote" to status["backendNote"],
      "runtimeAvailable" to true,
    )
  }

  private fun runtimeStatus(): Map<String, Any?> = mapOf(
    "ready" to (engine != null && conversation != null),
    "backend" to activeBackend,
    "backendNote" to backendNote,
    "modelPath" to modelPath,
  )

  private fun initializeModel(modelUri: String) {
    val path = Uri.parse(modelUri).let { if (it.scheme == "file") it.path else modelUri }
      ?: throw IllegalArgumentException("The model path is invalid.")
    if (!File(path).isFile) throw IllegalStateException("Download this model before using it offline.")
    if (modelPath == path && engine != null && conversation != null) return

    closeRuntime()
    val attempts = listOf("npu", "gpu", "cpu")
    val failures = mutableListOf<String>()

    for (backendName in attempts) {
      var candidate: Engine? = null
      try {
        candidate = Engine(
          EngineConfig(
            modelPath = path,
            backend = backendFor(backendName),
            cacheDir = context.cacheDir.absolutePath,
          ),
        )
        candidate.initialize()
        val candidateConversation = candidate.createConversation(
          ConversationConfig(
            systemInstruction = Contents.of(
              "You are Ginto, a concise and kind budgeting companion. Answer in the user's language. " +
                "Use only the current app-record summary and conversation for personal facts. " +
                "Be clear when something is an estimate, do not invent missing financial details, " +
                "and encourage checking official sources for legal or lender-specific questions.",
            ),
          ),
        )
        engine = candidate
        conversation = candidateConversation
        modelPath = path
        activeBackend = backendName.uppercase()
        backendNote = when {
          failures.isEmpty() -> ""
          else -> "${failures.first().uppercase()} was unavailable for this model; using ${activeBackend}."
        }
        return
      } catch (error: Throwable) {
        failures.add(backendName)
        runCatching { candidate?.close() }
      }
    }

    closeRuntime()
    throw IllegalStateException("This model could not start on NPU, GPU, or CPU.")
  }

  private fun backendFor(name: String): Backend = when (name) {
    "npu" -> Backend.NPU(nativeLibraryDir = context.applicationInfo.nativeLibraryDir)
    "gpu" -> Backend.GPU()
    else -> Backend.CPU()
  }

  private fun closeRuntime() {
    runCatching { conversation?.close() }
    runCatching { engine?.close() }
    conversation = null
    engine = null
    modelPath = null
    activeBackend = null
    backendNote = null
  }
}
