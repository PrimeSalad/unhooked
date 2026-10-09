import * as FileSystem from 'expo-file-system/legacy';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { remindIn } from '@/lib/notifications';

import {
  formatModelStorage,
  LOCAL_MODEL_BY_ID,
  modelPartialUri,
  modelUri,
  planModelDownload,
  STORAGE_HEADROOM,
  type LocalModelId,
} from './localModels';

/**
 * App-wide model download manager. Lives at module scope so a download survives the
 * screen that started it; interrupted downloads keep their .partial file and resume
 * via a Range request instead of restarting from zero.
 */
type ModelDownloadState = {
  active: { modelId: LocalModelId; value: number } | null;
  error: { modelId: LocalModelId; message: string } | null;
  completed: LocalModelId | null;
};

export const useModelDownloads = create<ModelDownloadState>(() => ({
  active: null,
  error: null,
  completed: null,
}));

export function clearCompletedDownload() {
  useModelDownloads.setState({ completed: null });
}

let task: FileSystem.DownloadResumable | null = null;
let cancelRequested = false;
let lastProgressWrite = 0;

export async function startModelDownload(modelId: LocalModelId): Promise<void> {
  if (useModelDownloads.getState().active) return;

  const profile = LOCAL_MODEL_BY_ID[modelId];
  const uri = modelUri(modelId);
  const partialUri = modelPartialUri(modelId);
  const directory = uri ? uri.slice(0, uri.lastIndexOf('/') + 1) : null;
  if (!uri || !partialUri || !directory) {
    useModelDownloads.setState({
      error: { modelId, message: 'Model storage is not available on this device.' },
    });
    return;
  }

  cancelRequested = false;
  lastProgressWrite = 0;
  useModelDownloads.setState({ active: { modelId, value: 0 }, error: null });

  try {
    const directoryInfo = await FileSystem.getInfoAsync(directory);
    if (!directoryInfo.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }

    const partialInfo = await FileSystem.getInfoAsync(partialUri);
    const partialSize = partialInfo.exists ? (partialInfo.size ?? 0) : 0;
    let plan = planModelDownload(partialSize, profile.bytes);
    if (plan.kind === 'resume') {
      useModelDownloads.setState({ active: { modelId, value: partialSize / profile.bytes } });
    }

    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    if (freeBytes < profile.bytes - partialSize + STORAGE_HEADROOM) {
      throw new Error(
        `Free up space first. Keep at least ${formatModelStorage(profile.bytes + STORAGE_HEADROOM)} available.`,
      );
    }

    let retriedFresh = false;
    while (plan.kind !== 'complete') {
      const resumable = FileSystem.createDownloadResumable(
        profile.url,
        partialUri,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          // Resumed downloads report totals that already include the offset.
          const total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : profile.bytes;
          const value = Math.min(1, totalBytesWritten / total);
          const now = Date.now();
          if (now - lastProgressWrite >= 300 || value >= 1) {
            lastProgressWrite = now;
            useModelDownloads.setState({ active: { modelId, value } });
          }
        },
        plan.kind === 'resume' ? String(plan.offset) : undefined,
      );
      task = resumable;
      let result;
      try {
        result = await resumable.downloadAsync();
      } finally {
        if (task === resumable) task = null;
      }
      if (!result || cancelRequested) return;
      if (plan.kind === 'resume' && result.status === 200) {
        // The host ignored the Range header and appended a whole fresh copy: the
        // partial is corrupt. Retry once from scratch; a fresh 200 is a success.
        if (retriedFresh) throw new Error('The model host ignored the resume offset.');
        retriedFresh = true;
        await FileSystem.deleteAsync(partialUri, { idempotent: true });
        plan = { kind: 'fresh' };
        continue;
      }
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`The model host returned HTTP ${result.status}.`);
      }
      break;
    }

    const downloaded = await FileSystem.getInfoAsync(partialUri);
    if (!downloaded.exists || (downloaded.size ?? 0) < profile.bytes) {
      throw new Error('The model download was incomplete. Check your connection and try again.');
    }

    await FileSystem.deleteAsync(uri, { idempotent: true });
    await FileSystem.moveAsync({ from: partialUri, to: uri });
    useModelDownloads.setState({ active: null, completed: modelId });
    if (AppState.currentState !== 'active') {
      void remindIn(1, 'Download finished', 'Your offline AI model is ready.');
    }
  } catch (e) {
    if (cancelRequested) return;
    useModelDownloads.setState({
      active: null,
      error: {
        modelId,
        message: e instanceof Error ? e.message : 'The model could not be downloaded.',
      },
    });
  }
}

export async function cancelModelDownload(): Promise<void> {
  const current = task;
  const modelId = useModelDownloads.getState().active?.modelId;
  cancelRequested = true;
  task = null;
  useModelDownloads.setState({ active: null });
  if (current) await current.cancelAsync().catch(() => undefined);
  const partialUri = modelId ? modelPartialUri(modelId) : null;
  if (partialUri) {
    await FileSystem.deleteAsync(partialUri, { idempotent: true }).catch(() => undefined);
  }
}

/** How much of a model is already sitting in its .partial file (0 when none). */
export async function readPartialProgress(modelId: LocalModelId): Promise<number> {
  const partialUri = modelPartialUri(modelId);
  if (!partialUri) return 0;
  const info = await FileSystem.getInfoAsync(partialUri).catch(() => null);
  if (!info?.exists) return 0;
  return Math.min(1, (info.size ?? 0) / LOCAL_MODEL_BY_ID[modelId].bytes);
}
