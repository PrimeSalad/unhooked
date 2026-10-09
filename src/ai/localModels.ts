import * as FileSystem from 'expo-file-system/legacy';

export type LocalModelId = 'qwen3-0.6b' | 'qwen2.5-1.5b' | 'gemma4-e2b' | 'gemma4-e4b';
export type LocalModelChoice = 'auto' | LocalModelId;
export type PerformanceMode = 'balanced' | 'max';

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
  use: string;
  url: string;
};

const model = (profile: Omit<LocalModelProfile, 'url'>): LocalModelProfile => ({
  ...profile,
  url: `https://huggingface.co/${profile.repo}/resolve/${profile.revision}/${profile.fileName}?download=true`,
});

export const LOCAL_MODELS: LocalModelProfile[] = [
  // The Gemma 3 1B repo on Hugging Face is license-gated (401 without a token),
  // so Qwen 3 0.6B is the downloadable entry-level model.
  model({
    id: 'qwen3-0.6b',
    tier: 'Lighter',
    name: 'Qwen 3 0.6B',
    modality: 'Text',
    sizeLabel: '~500 MB',
    bytes: 497_516_544,
    fileName: 'qwen3_0_6b_mixed_int4.litertlm',
    repo: 'litert-community/Qwen3-0.6B',
    revision: 'a3c5d805ae362dff7f580bc25f2dfb9a5a7eaa76',
    hardware: '3–4 GB RAM',
    use: 'Fast replies · low memory or battery',
  }),
  model({
    id: 'qwen2.5-1.5b',
    tier: 'Balanced',
    name: 'Qwen 2.5 1.5B',
    modality: 'Text',
    sizeLabel: '~1.6 GB',
    bytes: 1_597_931_520,
    fileName: 'Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv4096.litertlm',
    repo: 'litert-community/Qwen2.5-1.5B-Instruct',
    revision: '19edb84c69a0212f29a6ef17ba0d6f278b6a1614',
    hardware: '4–6 GB RAM',
    use: 'Everyday chat · multilingual · coding',
  }),
  model({
    id: 'gemma4-e2b',
    tier: 'Higher',
    name: 'Gemma 4 E2B',
    modality: 'Text + Vision',
    sizeLabel: '~2.6 GB',
    bytes: 2_588_147_712,
    fileName: 'gemma-4-E2B-it.litertlm',
    repo: 'litert-community/gemma-4-E2B-it-litert-lm',
    revision: 'b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1',
    hardware: '6 GB+ RAM',
    use: 'Images · receipts · deeper reasoning',
  }),
  model({
    id: 'gemma4-e4b',
    tier: 'Higher+',
    name: 'Gemma 4 E4B',
    modality: 'Text + Vision',
    sizeLabel: '~3.7 GB',
    bytes: 3_659_530_240,
    fileName: 'gemma-4-E4B-it.litertlm',
    repo: 'litert-community/gemma-4-E4B-it-litert-lm',
    revision: '2eee7ac325f20eb8c9ac1d0e972f7c84663062da',
    hardware: '8 GB+ RAM',
    use: 'Best quality · detailed visual reasoning',
  }),
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

export function recommendLocalModel(device: AndroidDeviceProfile | null): LocalModelId {
  // Unknown hardware: the lightest model is the one most likely to start.
  if (!device?.totalMemoryBytes) return 'qwen3-0.6b';

  const totalRam = device.totalMemoryBytes;
  const availableRam = device.availableMemoryBytes ?? totalRam;
  const lowBattery =
    device.batteryPercent != null && device.batteryPercent < 20 && device.charging !== true;
  const tightRam = device.lowMemory === true || availableRam < 1.5 * GB;

  if (totalRam < 4 * GB || lowBattery || tightRam) return 'qwen3-0.6b';

  const hasSpace = (id: LocalModelId) =>
    device.freeStorageBytes == null ||
    device.freeStorageBytes >= LOCAL_MODEL_BY_ID[id].bytes + STORAGE_HEADROOM;

  if (totalRam >= 8 * GB && availableRam >= 4 * GB && hasSpace('gemma4-e4b')) {
    return 'gemma4-e4b';
  }
  if (totalRam >= 6 * GB && availableRam >= 3 * GB && hasSpace('gemma4-e2b')) {
    return 'gemma4-e2b';
  }
  if (totalRam >= 4 * GB && availableRam >= 2 * GB && hasSpace('qwen2.5-1.5b')) {
    return 'qwen2.5-1.5b';
  }
  return 'qwen3-0.6b';
}

export function isVisionModel(id: LocalModelId): boolean {
  return LOCAL_MODEL_BY_ID[id]?.modality === 'Text + Vision';
}

const VISION_MODELS: LocalModelId[] = ['gemma4-e2b', 'gemma4-e4b'];

export function pickLocalModel(
  choice: LocalModelChoice,
  recommended: LocalModelId,
  installed: ReadonlySet<LocalModelId>,
  needs: 'any' | 'text' | 'vision' = 'any',
): LocalModelId | null {
  const preferred = choice === 'auto' ? recommended : choice;
  if (needs === 'vision') {
    if (installed.has(preferred) && isVisionModel(preferred)) return preferred;
    return VISION_MODELS.find((id) => installed.has(id)) ?? null;
  }
  const pool = LOCAL_MODELS.filter(
    (m) => installed.has(m.id) && (needs === 'any' || m.modality === 'Text'),
  );
  if (!pool.length) return null;
  const poolIds = new Set(pool.map((m) => m.id));
  const cap = LOCAL_MODEL_BY_ID[recommended].bytes;
  const order: LocalModelId[] = [
    ...(choice !== 'auto' ? [choice] : []),
    recommended,
    // Prefer models no bigger than the recommendation (largest first), then the rest.
    ...pool
      .filter((m) => m.bytes <= cap)
      .sort((a, b) => b.bytes - a.bytes)
      .map((m) => m.id),
    ...pool
      .filter((m) => m.bytes > cap)
      .sort((a, b) => a.bytes - b.bytes)
      .map((m) => m.id),
  ];
  return order.find((id) => installed.has(id) && poolIds.has(id)) ?? null;
}

export function formatModelStorage(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}
