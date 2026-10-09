import * as FileSystem from 'expo-file-system/legacy';

export type LocalModelId = 'gemma3-1b' | 'qwen2.5-1.5b' | 'gemma4-e2b' | 'gemma4-e4b';
export type LocalModelChoice = 'auto' | LocalModelId;

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
  model({
    id: 'gemma3-1b',
    tier: 'Lighter',
    name: 'Gemma 3 1B',
    modality: 'Text',
    sizeLabel: '~555 MB',
    bytes: 584_417_280,
    fileName: 'gemma3-1b-it-int4.litertlm',
    repo: 'litert-community/Gemma3-1B-IT',
    revision: 'a6306a4e292016480083b73b8dc6f3f939ae04c3',
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
  return MODEL_DIRECTORY ? `${MODEL_DIRECTORY}${LOCAL_MODEL_BY_ID[id].fileName}` : null;
}

export function modelPartialUri(id: LocalModelId): string | null {
  const uri = modelUri(id);
  return uri ? `${uri}.partial` : null;
}

const GB = 1_000_000_000;
const STORAGE_HEADROOM = 400_000_000;

export function recommendLocalModel(device: AndroidDeviceProfile | null): LocalModelId {
  if (!device?.totalMemoryBytes) return 'qwen2.5-1.5b';

  const totalRam = device.totalMemoryBytes;
  const availableRam = device.availableMemoryBytes ?? totalRam;
  const lowBattery =
    device.batteryPercent != null && device.batteryPercent < 20 && device.charging !== true;
  const tightRam = device.lowMemory === true || availableRam < 1.5 * GB;

  if (totalRam < 4 * GB || lowBattery || tightRam) return 'gemma3-1b';

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
  return 'gemma3-1b';
}

export function formatModelStorage(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}
