package expo.modules.gintolocalai

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.sqrt

/**
 * On-device Whisper transcription for Filipino, Taglish, and English.
 * Audio stays in memory until this phone turns it into text.
 */
class WhisperSpeech {
  private val stop = AtomicBoolean(false)
  private val session = AtomicInteger(0)
  private val recognizerLock = Any()
  private var recognizer: OfflineRecognizer? = null
  private var recognizerKey: String? = null
  private var worker: Thread? = null

  fun start(
    encoderPath: String,
    decoderPath: String,
    tokensPath: String,
    onSuccess: (String) -> Unit,
    onError: (String, String, Throwable?) -> Unit,
  ) {
    val mine = session.incrementAndGet()
    stop.set(false)
    worker = Thread {
      var recorder: AudioRecord? = null
      try {
        val captured = record(mine)
        recorder = captured.recorder
        if (mine != session.get()) return@Thread
        if (!captured.heard) {
          onError(
            "ERR_SPEECH_NO_MATCH",
            "I didn't hear any words. Tap the mic and speak Tagalog, Taglish, or English.",
            null,
          )
          return@Thread
        }
        val text = transcribe(encoderPath, decoderPath, tokensPath, captured.samples)
        if (mine != session.get()) return@Thread
        if (text.isBlank()) {
          onError(
            "ERR_SPEECH_NO_MATCH",
            "I didn't hear any words. Tap the mic and speak Tagalog, Taglish, or English.",
            null,
          )
        } else {
          onSuccess(text)
        }
      } catch (error: Throwable) {
        if (mine != session.get()) return@Thread
        onError(
          "ERR_SPEECH_RECOGNITION",
          error.message ?: "Voice input stopped. Please try again.",
          error,
        )
      } finally {
        runCatching { recorder?.release() }
      }
    }.also { it.name = "ginto-whisper"; it.start() }
  }

  fun requestStop() {
    stop.set(true)
  }

  fun cancel() {
    session.incrementAndGet()
    stop.set(true)
  }

  fun close() {
    cancel()
    synchronized(recognizerLock) {
      runCatching { recognizer?.release() }
      recognizer = null
      recognizerKey = null
    }
  }

  private data class Capture(val samples: FloatArray, val heard: Boolean, val recorder: AudioRecord?)

  @SuppressLint("MissingPermission")
  private fun record(mine: Int): Capture {
    val sampleRate = 16_000
    val channel = AudioFormat.CHANNEL_IN_MONO
    val encoding = AudioFormat.ENCODING_PCM_16BIT
    val minBuffer = AudioRecord.getMinBufferSize(sampleRate, channel, encoding)
    if (minBuffer <= 0) throw IllegalStateException("The microphone could not start.")
    val recorder = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      sampleRate,
      channel,
      encoding,
      minBuffer * 2,
    )
    if (recorder.state != AudioRecord.STATE_INITIALIZED) {
      recorder.release()
      throw IllegalStateException("The microphone could not start.")
    }
    recorder.startRecording()
    val maxSamples = sampleRate * 20
    val samples = ArrayList<Float>(sampleRate * 4)
    val buffer = ShortArray(minBuffer.coerceAtLeast(sampleRate / 10))
    val noise = ArrayList<Double>(12)
    var speechRunMs = 0
    var silenceMs = 0
    var speechStart = -1
    var speechEnd = -1
    val startedAt = System.currentTimeMillis()
    while (!stop.get() && mine == session.get() && samples.size < maxSamples) {
      val read = recorder.read(buffer, 0, buffer.size)
      if (read <= 0) continue
      var energy = 0.0
      val frameStart = samples.size
      for (index in 0 until read) {
        val sample = buffer[index] / 32768f
        samples.add(sample)
        energy += sample * sample
      }
      val rms = sqrt(energy / read)
      val chunkMs = read * 1000 / sampleRate
      val elapsed = System.currentTimeMillis() - startedAt
      if (elapsed < 280) {
        noise.add(rms)
        continue
      }
      val floor = noiseFloor(noise)
      val speechCut = maxOf(floor * 3.2, 0.028)
      if (rms >= speechCut) {
        speechRunMs += chunkMs
        silenceMs = 0
        if (speechRunMs >= 180) {
          if (speechStart < 0) speechStart = frameStart
          speechEnd = samples.size
        }
      } else {
        speechRunMs = 0
        if (speechStart >= 0) silenceMs += chunkMs
      }
      if (speechStart >= 0 && silenceMs >= 850) break
      if (elapsed > 20_000) break
    }
    runCatching { recorder.stop() }
    val heard = speechStart >= 0 && speechEnd - speechStart > sampleRate / 3
    val trimmed = if (!heard) {
      FloatArray(0)
    } else {
      val from = (speechStart - sampleRate / 5).coerceAtLeast(0)
      val to = (speechEnd + sampleRate / 4).coerceAtMost(samples.size)
      samples.subList(from, to).toFloatArray()
    }
    return Capture(trimmed, heard, recorder)
  }

  private fun noiseFloor(samples: List<Double>): Double {
    if (samples.isEmpty()) return 0.01
    val sorted = samples.sorted()
    return sorted[sorted.size / 4]
  }

  private fun transcribe(
    encoderPath: String,
    decoderPath: String,
    tokensPath: String,
    samples: FloatArray,
  ): String {
    val active = recognizerFor(encoderPath, decoderPath, tokensPath)
    val stream = active.createStream()
    try {
      stream.acceptWaveform(samples, 16_000)
      active.decode(stream)
      return active.getResult(stream).text.trim()
    } finally {
      stream.release()
    }
  }

  private fun recognizerFor(
    encoderPath: String,
    decoderPath: String,
    tokensPath: String,
  ): OfflineRecognizer {
    val key = "$encoderPath|$decoderPath|$tokensPath"
    synchronized(recognizerLock) {
      val current = recognizer
      if (current != null && recognizerKey == key) return current
      runCatching { current?.release() }
      val created = OfflineRecognizer(
        config = OfflineRecognizerConfig(
          featConfig = FeatureConfig(sampleRate = 16_000, featureDim = 80, dither = 0f),
          modelConfig = OfflineModelConfig(
            whisper = OfflineWhisperModelConfig(
              encoder = encoderPath,
              decoder = decoderPath,
              language = "tl",
              task = "transcribe",
              tailPaddings = 300,
            ),
            tokens = tokensPath,
            modelType = "whisper",
            numThreads = 4,
          ),
        ),
      )
      recognizer = created
      recognizerKey = key
      return created
    }
  }
}
