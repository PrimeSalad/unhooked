import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { AndroidDeviceProfile, LocalModelChoice, LocalModelId } from './localModels';
import { modelUri, recommendLocalModel } from './localModels';

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
  closeModel(): void;
};

const NativeLocalAi = requireOptionalNativeModule<GintoLocalAiNativeModule>('GintoLocalAi');

export function hasAndroidLocalAiRuntime(): boolean {
  return Platform.OS === 'android' && NativeLocalAi != null;
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

export async function generateAndroidLocalReply(
  modelChoice: LocalModelChoice,
  question: string,
  contextSummary: string,
): Promise<(LocalGeneration & { modelId: LocalModelId }) | null> {
  if (!hasAndroidLocalAiRuntime() || !NativeLocalAi) return null;

  const device = await inspectAndroidDevice();
  const modelId = modelChoice === 'auto' ? recommendLocalModel(device) : modelChoice;
  const uri = modelUri(modelId);
  if (!uri) return null;

  const file = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (!file?.exists) return null;

  const prompt = [
    'Current private app records (use only these numbers for personal facts):',
    contextSummary,
    '',
    `User's message: ${question}`,
  ].join('\n');
  const result = await NativeLocalAi.generate(uri, prompt);
  return { ...result, modelId };
}

export async function readAndroidLocalModelStatus(): Promise<RuntimeStatus | null> {
  return getAndroidRuntimeStatus();
}

export function closeAndroidLocalModel(): void {
  if (hasAndroidLocalAiRuntime()) NativeLocalAi?.closeModel();
}
