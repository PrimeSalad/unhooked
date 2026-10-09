import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type {
  AndroidDeviceProfile,
  LocalModelChoice,
  LocalModelId,
  PerformanceMode,
  ProcessorChoice,
} from './localModels';
import {
  LOCAL_MODELS,
  isVisionModel,
  modelUri,
  pickLocalModel,
  recommendLocalModel,
} from './localModels';
import { PAUSE_SYSTEM_INSTRUCTION } from './pausePhrasing';

type RuntimeStatus = {
  ready: boolean;
  backend: string | null;
  backendNote: string | null;
  modelPath: string | null;
  performanceMode?: PerformanceMode;
  processor?: ProcessorChoice;
};

type NativeDeviceInfo = Partial<AndroidDeviceProfile>;

type LocalGeneration = {
  text: string;
  backend: string;
  backendNote?: string;
};

export type OnDeviceSpeechResult = {
  text: string;
  confidence?: number | null;
  languageTag: string;
};

type GintoLocalAiNativeModule = {
  inspectDevice(): Promise<NativeDeviceInfo>;
  getRuntimeStatus(): Promise<RuntimeStatus>;
  startModel(modelUri: string, vision: boolean): Promise<RuntimeStatus>;
  generate(
    modelUri: string,
    prompt: string,
    imagePath: string | null,
    vision: boolean,
  ): Promise<LocalGeneration>;
  /** One-shot generation in a fresh conversation (does not touch the chat history). */
  generateOnce?(
    modelUri: string,
    systemInstruction: string,
    prompt: string,
    vision: boolean,
  ): Promise<LocalGeneration>;
  analyzeMessageRisk?(modelUri: string, message: string): Promise<LocalGeneration>;
  setPerformanceMode?(mode: PerformanceMode): Promise<RuntimeStatus>;
  setProcessor?(p: ProcessorChoice): Promise<RuntimeStatus>;
  isOnDeviceSpeechRecognitionAvailable?(): boolean;
  recognizeSpeech?(languageTag: string): Promise<OnDeviceSpeechResult>;
  recognizeMultilingualSpeech?(modelDirectory: string): Promise<OnDeviceSpeechResult>;
  stopSpeechRecognition?(): Promise<void>;
  cancelSpeechRecognition?(): Promise<void>;
  closeModel(): void;
};

const NativeLocalAi = requireOptionalNativeModule<GintoLocalAiNativeModule>('GintoLocalAi');

/** Local inference is unbounded by nature; the UI always has a deterministic fallback. */
export const LOCAL_AI_TIMEOUT_MS = 20_000;

/** Engine start is a file mmap + compile: generous, and no longer billed to the reply. */
export const MODEL_START_TIMEOUT_MS = 90_000;

/** Reading a photo is slower than text; give vision turns a wider window. */
export const IMAGE_REPLY_TIMEOUT_MS = 60_000;

export class LocalAiTimeout extends Error {
  constructor(ms: number) {
    super(`The local model took longer than ${Math.round(ms / 1000)}s.`);
    this.name = 'LocalAiTimeout';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms = LOCAL_AI_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new LocalAiTimeout(ms)), ms);
    }),
  ]);
}

export function hasAndroidLocalAiRuntime(): boolean {
  return Platform.OS === 'android' && NativeLocalAi != null;
}

export function supportsAndroidMessageRiskAnalysis(): boolean {
  return hasAndroidLocalAiRuntime() && NativeLocalAi?.analyzeMessageRisk != null;
}

export function hasAndroidOnDeviceSpeechRecognition(): boolean {
  if (
    !hasAndroidLocalAiRuntime() ||
    NativeLocalAi?.isOnDeviceSpeechRecognitionAvailable == null
  ) {
    return false;
  }
  try {
    return NativeLocalAi.isOnDeviceSpeechRecognitionAvailable();
  } catch {
    return false;
  }
}

export function hasAndroidMultilingualSpeech(): boolean {
  return hasAndroidLocalAiRuntime() && NativeLocalAi?.recognizeMultilingualSpeech != null;
}

export async function recognizeMultilingualSpeech(
  modelDirectory: string,
): Promise<OnDeviceSpeechResult> {
  if (!NativeLocalAi?.recognizeMultilingualSpeech) {
    throw new Error('Install the latest Android build to use Tagalog voice input.');
  }
  return NativeLocalAi.recognizeMultilingualSpeech(modelDirectory);
}

export async function recognizeAndroidSpeech(
  languageTag = 'en-US',
): Promise<OnDeviceSpeechResult> {
  if (!hasAndroidOnDeviceSpeechRecognition() || !NativeLocalAi?.recognizeSpeech) {
    throw new Error('Private on-device voice input is not available on this phone.');
  }
  return NativeLocalAi.recognizeSpeech(languageTag);
}

export async function stopAndroidSpeechRecognition(): Promise<void> {
  await NativeLocalAi?.stopSpeechRecognition?.();
}

export async function cancelAndroidSpeechRecognition(): Promise<void> {
  await NativeLocalAi?.cancelSpeechRecognition?.();
}

export function isSpeechRecognitionCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as Error & { code?: string }).code === 'ERR_SPEECH_CANCELLED'
  );
}

export function supportsAndroidPausePhrasing(): boolean {
  return hasAndroidLocalAiRuntime() && NativeLocalAi?.generateOnce != null;
}

export function supportsPerformanceMode(): boolean {
  return hasAndroidLocalAiRuntime() && NativeLocalAi?.setPerformanceMode != null;
}

/** Same capability gate as pause phrasing: one-shot analysis (insights, chat) needs generateOnce. */
export function supportsAndroidAnalysis(): boolean {
  return supportsAndroidPausePhrasing();
}

// LiteRT-LM runs a single engine per process; two concurrent JS calls would race on the
// same native model. Serialize generation so at most one native call is in flight.
// A rejected job resolves the chain slot so the next call still runs.
let generationQueue: Promise<unknown> = Promise.resolve();

function enqueueGeneration<T>(job: () => Promise<T>): Promise<T> {
  const run = generationQueue.then(job, job);
  generationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function inspectAndroidDevice(): Promise<AndroidDeviceProfile | null> {
  if (Platform.OS !== 'android') return null;

  const native = NativeLocalAi
    ? await NativeLocalAi.inspectDevice().catch(() => null)
    : null;

  return {
    manufacturer: native?.manufacturer ?? Device.manufacturer,
    modelName: native?.modelName ?? Device.modelName,
    totalMemoryBytes: native?.totalMemoryBytes ?? Device.totalMemory,
    availableMemoryBytes: native?.availableMemoryBytes,
    lowMemory: native?.lowMemory,
    batteryPercent: native?.batteryPercent,
    charging: native?.charging,
    freeStorageBytes: native?.freeStorageBytes,
    androidVersion: native?.androidVersion ?? Device.osVersion,
    chipset: native?.chipset,
    socManufacturer: native?.socManufacturer,
    npuName: native?.npuName,
    npuReady: native?.npuReady,
    cpuCores: native?.cpuCores,
    performanceMode: native?.performanceMode,
    accelerator: native?.accelerator,
    acceleratorNote: native?.acceleratorNote,
    runtimeAvailable: NativeLocalAi != null,
  };
}

export async function getAndroidRuntimeStatus(): Promise<RuntimeStatus | null> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) return null;
  return NativeLocalAi.getRuntimeStatus().catch(() => null);
}

/**
 * Switches the backend plan (Balanced / Max). Queued behind any in-flight generation so
 * the engine swap can never race one. Returns null when the runtime or method is missing.
 */
export async function setAndroidPerformanceMode(
  mode: PerformanceMode,
): Promise<RuntimeStatus | null> {
  if (!supportsPerformanceMode() || !NativeLocalAi?.setPerformanceMode) return null;
  const setMode = NativeLocalAi.setPerformanceMode;
  try {
    return await enqueueGeneration(() => setMode(mode));
  } catch {
    return null;
  }
}

/** Same serialized swap as setAndroidPerformanceMode, for the processor preference. */
export async function setAndroidProcessor(p: ProcessorChoice): Promise<RuntimeStatus | null> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi?.setProcessor) return null;
  const set = NativeLocalAi.setProcessor;
  try {
    return await enqueueGeneration(() => set(p));
  } catch {
    return null;
  }
}

async function installedModels(): Promise<Set<LocalModelId>> {
  const results = await Promise.all(
    LOCAL_MODELS.map(async (profile) => {
      const uri = modelUri(profile.id);
      if (!uri) return null;
      const file = await FileSystem.getInfoAsync(uri).catch(() => null);
      return file?.exists && (file.size ?? 0) >= profile.bytes ? profile.id : null;
    }),
  );
  return new Set(results.filter((id): id is LocalModelId => id != null));
}

export async function startAndroidLocalModel(modelId: LocalModelId): Promise<RuntimeStatus> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) {
    throw new Error('Install an Android development build to run local models.');
  }
  const uri = modelUri(modelId);
  if (!uri) throw new Error('The model storage location is unavailable.');
  return NativeLocalAi.startModel(uri, isVisionModel(modelId));
}

/** The model file the native engine currently holds, matched against the catalog. */
async function loadedModelId(): Promise<LocalModelId | null> {
  const status = await getAndroidRuntimeStatus();
  const path = status?.ready ? status.modelPath : null;
  if (!path) return null;
  return LOCAL_MODELS.find((m) => path.endsWith(m.fileName))?.id ?? null;
}

export interface InstalledModel {
  modelId: LocalModelId;
  uri: string;
}

/**
 * Which downloaded model to run. The user's explicit choice wins when it is installed;
 * otherwise the device recommendation, then installed models no bigger than the
 * recommendation (largest first), then any larger installed model (lightest first).
 * Returns null only when nothing usable is on disk.
 */
export async function resolveInstalledModel(
  choice: LocalModelChoice,
  needs: 'any' | 'text' | 'vision' = 'any',
): Promise<InstalledModel | null> {
  const [device, installed, loaded] = await Promise.all([
    inspectAndroidDevice(),
    installedModels(),
    loadedModelId(),
  ]);
  const modelId = pickLocalModel(
    choice,
    recommendLocalModel(device),
    installed,
    needs,
    loaded,
  );
  if (!modelId) return null;
  const uri = modelUri(modelId);
  return uri ? { modelId, uri } : null;
}

/** True when at least one model is downloaded; cheap enough to call at launch. */
export async function hasInstalledLocalModel(): Promise<boolean> {
  if (!hasAndroidLocalAiRuntime()) return false;
  return (await resolveInstalledModel('auto')) != null;
}

/**
 * Loads the chosen model into memory ahead of time so the first pause or chat turn does
 * not pay the cold start. Safe to call repeatedly; failures are swallowed.
 */
export async function warmAndroidLocalModel(
  choice: LocalModelChoice,
): Promise<string | null> {
  try {
    if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) return null;
    const model = await resolveInstalledModel(choice);
    if (!model) return null;
    const status = await NativeLocalAi.startModel(model.uri, isVisionModel(model.modelId));
    return status.backend;
  } catch {
    return null;
  }
}

export async function canAnswerImageLocally(modelChoice: LocalModelChoice): Promise<boolean> {
  if (!hasAndroidLocalAiRuntime()) return false;
  return (await resolveInstalledModel(modelChoice, 'vision')) != null;
}

export async function generateAndroidLocalReply(
  modelChoice: LocalModelChoice,
  question: string,
  contextSummary: string,
  history: { role: 'user' | 'ginto'; text: string }[],
  computedAnswer?: string | null,
  imageUri?: string,
  strict = false,
  onPhase?: (phase: 'loading' | 'thinking', modelId: LocalModelId) => void,
): Promise<(LocalGeneration & { modelId: LocalModelId }) | null> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) return null;

  const model = await resolveInstalledModel(modelChoice, imageUri ? 'vision' : 'any');
  if (!model) return null;

  const message =
    imageUri && !question
      ? 'What is in this photo? If it is a bill, receipt, loan offer or a message from a lender or collector, list the key amounts, dates and any warning signs.'
      : question;
  const turns = history
    .filter((m) => m.text.trim())
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Them' : 'You'}: ${m.text.slice(0, 300)}`);
  const prompt = [
    'Current private app records (use only these numbers for personal facts):',
    contextSummary,
    ...(computedAnswer
      ? [
          '',
          'Facts the app computed for this question (use these numbers exactly):',
          computedAnswer,
        ]
      : []),
    ...(turns.length ? ['', 'Conversation so far:', ...turns] : []),
    '',
    strict
      ? 'Your previous draft was rejected for using a number not written above or for being too long. Reply again in at most two short sentences. Only use numbers copied exactly from above; if a number is not there, say you do not have it yet.'
      : "Answer the person's latest message using the records above. Reply in at most three short sentences. Do not introduce any amount, date or count that is not written above.",
    '',
    `User's message: ${message}`,
  ].join('\n');
  // One job: start the model (separate, longer timeout) only when the engine holds a
  // different file, then generate. Model load time no longer eats the reply timeout.
  const result = await enqueueGeneration(async () => {
    if ((await loadedModelId()) !== model.modelId) {
      onPhase?.('loading', model.modelId);
      await withTimeout(
        NativeLocalAi.startModel(model.uri, isVisionModel(model.modelId)),
        MODEL_START_TIMEOUT_MS,
      );
    }
    onPhase?.('thinking', model.modelId);
    return withTimeout(
      NativeLocalAi.generate(
        model.uri,
        prompt,
        imageUri ?? null,
        isVisionModel(model.modelId),
      ),
      imageUri ? IMAGE_REPLY_TIMEOUT_MS : LOCAL_AI_TIMEOUT_MS,
    );
  });
  return { ...result, modelId: model.modelId };
}

/**
 * One-shot generation in a fresh conversation: insights and the pause use it so reads
 * never inherit (or pollute) the Ask Ginto chat history. Serialized through
 * enqueueGeneration; the timeout starts when the job actually runs, not while queued.
 */
export async function generateAndroidOnce(
  modelChoice: LocalModelChoice,
  systemInstruction: string,
  prompt: string,
  timeoutMs = LOCAL_AI_TIMEOUT_MS,
): Promise<(LocalGeneration & { modelId: LocalModelId; ms: number }) | null> {
  if (!supportsAndroidPausePhrasing() || !NativeLocalAi?.generateOnce) return null;
  const generateOnce = NativeLocalAi.generateOnce;

  const model = await resolveInstalledModel(modelChoice);
  if (!model) return null;

  const startedAt = Date.now();
  const result = await enqueueGeneration(() =>
    withTimeout(
      generateOnce(model.uri, systemInstruction, prompt, isVisionModel(model.modelId)),
      timeoutMs,
    ),
  );
  return { ...result, modelId: model.modelId, ms: Date.now() - startedAt };
}

/**
 * Asks the model to rephrase a pause reflection. Returns the raw text plus timing; the
 * caller runs it through applyPausePhrasing(), which rejects anything off-record.
 */
export async function phraseAndroidPause(
  modelChoice: LocalModelChoice,
  prompt: string,
  timeoutMs = LOCAL_AI_TIMEOUT_MS,
): Promise<(LocalGeneration & { modelId: LocalModelId; ms: number }) | null> {
  return generateAndroidOnce(modelChoice, PAUSE_SYSTEM_INSTRUCTION, prompt, timeoutMs);
}

/** Analyze copied text with an installed text-only model. Vision models are never selected here. */
export async function analyzeAndroidMessageRisk(
  message: string,
): Promise<(LocalGeneration & { modelId: LocalModelId }) | null> {
  if (!supportsAndroidMessageRiskAnalysis() || !NativeLocalAi?.analyzeMessageRisk) return null;

  const model = await resolveInstalledModel('auto', 'text');
  if (!model) return null;

  const result = await withTimeout(NativeLocalAi.analyzeMessageRisk(model.uri, message));
  return { ...result, modelId: model.modelId };
}

export async function readAndroidLocalModelStatus(): Promise<RuntimeStatus | null> {
  return getAndroidRuntimeStatus();
}

export function closeAndroidLocalModel(): void {
  if (hasAndroidLocalAiRuntime()) NativeLocalAi?.closeModel();
}
