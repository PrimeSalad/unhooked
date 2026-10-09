import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { AndroidDeviceProfile, LocalModelChoice, LocalModelId } from './localModels';
import { LOCAL_MODEL_BY_ID, LOCAL_MODELS, modelUri, recommendLocalModel } from './localModels';
import { PAUSE_SYSTEM_INSTRUCTION } from './pausePhrasing';

type RuntimeStatus = {
  ready: boolean;
  backend: string | null;
  backendNote: string | null;
  modelPath: string | null;
};

type NativeDeviceInfo = Partial<AndroidDeviceProfile>;

type LocalGeneration = {
  text: string;
  backend: string;
  backendNote?: string;
};

type GintoLocalAiNativeModule = {
  inspectDevice(): Promise<NativeDeviceInfo>;
  getRuntimeStatus(): Promise<RuntimeStatus>;
  startModel(modelUri: string): Promise<RuntimeStatus>;
  generate(modelUri: string, prompt: string): Promise<LocalGeneration>;
  /** One-shot generation in a fresh conversation (does not touch the chat history). */
  generateOnce?(modelUri: string, systemInstruction: string, prompt: string): Promise<LocalGeneration>;
  analyzeMessageRisk?(modelUri: string, message: string): Promise<LocalGeneration>;
  closeModel(): void;
};

const NativeLocalAi = requireOptionalNativeModule<GintoLocalAiNativeModule>('GintoLocalAi');

/** Local inference is unbounded by nature; the UI always has a deterministic fallback. */
export const LOCAL_AI_TIMEOUT_MS = 20_000;

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

export function supportsAndroidPausePhrasing(): boolean {
  return hasAndroidLocalAiRuntime() && NativeLocalAi?.generateOnce != null;
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
    accelerator: native?.accelerator,
    acceleratorNote: native?.acceleratorNote,
    runtimeAvailable: NativeLocalAi != null,
  };
}

export async function getAndroidRuntimeStatus(): Promise<RuntimeStatus | null> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) return null;
  return NativeLocalAi.getRuntimeStatus().catch(() => null);
}

export async function startAndroidLocalModel(modelId: LocalModelId): Promise<RuntimeStatus> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) {
    throw new Error('Install an Android development build to run local models.');
  }
  const uri = modelUri(modelId);
  if (!uri) throw new Error('The model storage location is unavailable.');
  return NativeLocalAi.startModel(uri);
}

export interface InstalledModel {
  modelId: LocalModelId;
  uri: string;
}

async function isInstalled(modelId: LocalModelId): Promise<InstalledModel | null> {
  const uri = modelUri(modelId);
  if (!uri) return null;
  const file = await FileSystem.getInfoAsync(uri).catch(() => null);
  return file?.exists && (file.size ?? 0) >= LOCAL_MODEL_BY_ID[modelId].bytes
    ? { modelId, uri }
    : null;
}

/**
 * Which downloaded model to run. The user's explicit choice wins when it is installed;
 * otherwise the device recommendation, then any installed model from lightest to heaviest.
 * Never silently returns null while a usable model is on disk.
 */
export async function resolveInstalledModel(
  choice: LocalModelChoice,
  options: { textOnly?: boolean } = {},
): Promise<InstalledModel | null> {
  const device = await inspectAndroidDevice();
  const recommended = recommendLocalModel(device);
  const pool = LOCAL_MODELS.filter((m) => !options.textOnly || m.modality === 'Text').map(
    (m) => m.id,
  );
  const order = [
    ...(choice !== 'auto' ? [choice] : []),
    recommended,
    ...pool,
  ].filter((id, i, all) => pool.includes(id) && all.indexOf(id) === i);

  for (const modelId of order) {
    const installed = await isInstalled(modelId);
    if (installed) return installed;
  }
  return null;
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
export async function warmAndroidLocalModel(choice: LocalModelChoice): Promise<void> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) return;
  const model = await resolveInstalledModel(choice).catch(() => null);
  if (!model) return;
  await NativeLocalAi.startModel(model.uri).catch(() => undefined);
}

export async function generateAndroidLocalReply(
  modelChoice: LocalModelChoice,
  question: string,
  contextSummary: string,
  computedAnswer?: string | null,
): Promise<(LocalGeneration & { modelId: LocalModelId }) | null> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) return null;

  const model = await resolveInstalledModel(modelChoice);
  if (!model) return null;

  const prompt = [
    'Current private app records (use only these numbers for personal facts):',
    contextSummary,
    ...(computedAnswer
      ? [
          '',
          'The app already computed this answer from the records. Keep every number exactly as written; you may only make the wording warmer and shorter:',
          computedAnswer,
        ]
      : []),
    '',
    'Reply in at most three short sentences. Do not introduce any amount, date or count that is not written above.',
    '',
    `User's message: ${question}`,
  ].join('\n');
  const result = await withTimeout(NativeLocalAi.generate(model.uri, prompt));
  return { ...result, modelId: model.modelId };
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
  if (!supportsAndroidPausePhrasing() || !NativeLocalAi?.generateOnce) return null;

  const model = await resolveInstalledModel(modelChoice);
  if (!model) return null;

  const startedAt = Date.now();
  const result = await withTimeout(
    NativeLocalAi.generateOnce(model.uri, PAUSE_SYSTEM_INSTRUCTION, prompt),
    timeoutMs,
  );
  return { ...result, modelId: model.modelId, ms: Date.now() - startedAt };
}

/** Analyze copied text with an installed text-only model. Vision models are never selected here. */
export async function analyzeAndroidMessageRisk(
  message: string,
): Promise<(LocalGeneration & { modelId: LocalModelId }) | null> {
  if (!supportsAndroidMessageRiskAnalysis() || !NativeLocalAi?.analyzeMessageRisk) return null;

  const model = await resolveInstalledModel('auto', { textOnly: true });
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
