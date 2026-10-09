import * as FileSystem from 'expo-file-system/legacy';

export type LocalModelId = 'gemma4-e2b' | 'gemma4-e4b';
export type LocalModelChoice = 'auto' | LocalModelId;
export type PerformanceMode = 'balanced' | 'max';
export type ProcessorChoice = 'auto' | 'npu' | 'gpu' | 'cpu';

export type AndroidDeviceProfile = {
  manufacturer: string | null;
  modelName: string | null;
  totalMemoryBytes: number | null;
  availableMemoryBytes?: number;
  lowMemory?: boolean;
  batteryPercent?: number | null;
  charging?: boolean;
  freeStorageBytes?: number;
  androidVersion?: string | null;
  chipset?: string | null;
  socManufacturer?: string | null;
  npuName?: string | null;
  npuReady?: boolean;
  cpuCores?: number;
  performanceMode?: PerformanceMode;
  accelerator?: string | null;
  acceleratorNote?: string | null;
  runtimeAvailable: boolean;
};

export type LocalModelProfile = {
  id: LocalModelId;
  tier: string;
  name: string;
  modality: string;
  sizeLabel: string;
  bytes: number;
  fileName: string;
  repo: string;
  revision: string;
  hardware: string;
  /** Smallest phone RAM (as Android reports it) the model is offered on. */
  minRamBytes: number;
  use: string;
  url: string;
};

const model = (profile: Omit<LocalModelProfile, 'url'>): LocalModelProfile => ({
  ...profile,
  url: `https://huggingface.co/${profile.repo}/resolve/${profile.revision}/${profile.fileName}?download=true`,
});

export const LOCAL_MODELS: LocalModelProfile[] = [
  model({
    id: 'gemma4-e2b',
    tier: 'Default',
    name: 'Gemma 4 E2B',
    modality: 'Text + Vision',
    sizeLabel: '~2.6 GB',
    bytes: 2_588_147_712,
    fileName: 'gemma-4-E2B-it.litertlm',
    repo: 'litert-community/gemma-4-E2B-it-litert-lm',
    revision: 'b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1',
    hardware: '6 GB+ RAM',
    // A "6 GB" phone reports about 5.6 GB.
    minRamBytes: 5_500_000_000,
    use: 'Recommended · chat, receipts and photos',
  }),
  model({
    id: 'gemma4-e4b',
    tier: 'Higher',
    name: 'Gemma 4 E4B',
    modality: 'Text + Vision',
    sizeLabel: '~3.7 GB',
    bytes: 3_659_530_240,
    fileName: 'gemma-4-E4B-it.litertlm',
    repo: 'litert-community/gemma-4-E4B-it-litert-lm',
    revision: '2eee7ac325f20eb8c9ac1d0e972f7c84663062da',
    hardware: '12 GB+ RAM · high-end phones',
    // High-end only: a "12 GB" phone reports about 12.0 GB; 8 GB phones run out of memory.
    minRamBytes: 11_500_000_000,
    use: 'Sharper answers · detailed photo reading',
  }),
];

/** Files of models dropped from the catalog; deleted on launch to give the storage back. */
export const RETIRED_MODEL_FILES = [
  'qwen3_0_6b_mixed_int4.litertlm',
  'Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv4096.litertlm',
];

export const LOCAL_MODEL_BY_ID = Object.fromEntries(
  LOCAL_MODELS.map((entry) => [entry.id, entry]),
) as Record<LocalModelId, LocalModelProfile>;

export const MODEL_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}models/`
  : null;

export function modelUri(id: LocalModelId): string | null {
  // id can be a stale persisted choice whose model was removed from the catalog.
  const profile = (LOCAL_MODEL_BY_ID as Record<string, LocalModelProfile | undefined>)[id];
  return MODEL_DIRECTORY && profile ? `${MODEL_DIRECTORY}${profile.fileName}` : null;
}

export function modelPartialUri(id: LocalModelId): string | null {
  const uri = modelUri(id);
  return uri ? `${uri}.partial` : null;
}

const GB = 1_000_000_000;
export const STORAGE_HEADROOM = 400_000_000;

export type DownloadPlan =
  | { kind: 'fresh' }
  | { kind: 'resume'; offset: number }
  | { kind: 'complete' };

export function planModelDownload(
  partialBytes: number | null | undefined,
  totalBytes: number,
): DownloadPlan {
  const partial = partialBytes ?? 0;
  if (partial >= totalBytes) return { kind: 'complete' };
  if (partial > 0) return { kind: 'resume', offset: partial };
  return { kind: 'fresh' };
}

/** Gemma 4 E2B is the default on every phone; E4B is an opt-in for phones with RAM to spare. */
export function recommendLocalModel(_device: AndroidDeviceProfile | null): LocalModelId {
  return 'gemma4-e2b';
}

/** Unknown RAM (web, Expo Go) offers every model; the native memory guard still applies. */
export function fitsDevice(id: LocalModelId, totalMemoryBytes: number | null | undefined): boolean {
  return totalMemoryBytes == null || totalMemoryBytes >= LOCAL_MODEL_BY_ID[id].minRamBytes;
}

export function isVisionModel(id: LocalModelId): boolean {
  return LOCAL_MODEL_BY_ID[id]?.modality === 'Text + Vision';
}

export function pickLocalModel(
  choice: LocalModelChoice,
  recommended: LocalModelId,
  installed: ReadonlySet<LocalModelId>,
  needs: 'any' | 'vision' = 'any',
  loaded: LocalModelId | null = null,
): LocalModelId | null {
  // A persisted choice can name a model that has since left the catalog.
  const known = choice === 'auto' || choice in LOCAL_MODEL_BY_ID;
  const pinned = known && choice !== 'auto' ? choice : null;
  // Auto keeps the model already in memory when it fits the need: switching the engine
  // to another file costs a multi-second reload.
  if (!pinned && loaded != null && installed.has(loaded)) {
    if (needs === 'any' || isVisionModel(loaded)) return loaded;
  }
  const order: LocalModelId[] = [
    ...(pinned ? [pinned] : []),
    recommended,
    // Then the smallest installed model, the one most likely to fit in memory.
    ...[...LOCAL_MODELS].sort((a, b) => a.bytes - b.bytes).map((m) => m.id),
  ];
  return (
    order.find((id) => installed.has(id) && (needs === 'any' || isVisionModel(id))) ?? null
  );
}

export function formatModelStorage(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}
