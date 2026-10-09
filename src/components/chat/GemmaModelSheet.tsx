import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Button, IconButton, ProgressBar, Sheet, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';

const MODEL_FILE = 'gemma-4-E2B-it.litertlm';
const MODEL_BYTES = 2_588_147_712;
const MINIMUM_FREE_BYTES = MODEL_BYTES + 400_000_000;
const MODEL_REVISION = 'b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1';
const MODEL_URL = `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/${MODEL_REVISION}/${MODEL_FILE}?download=true`;
const MODEL_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}models/`
  : null;
const MODEL_URI = MODEL_DIRECTORY ? `${MODEL_DIRECTORY}${MODEL_FILE}` : null;
const PARTIAL_URI = MODEL_URI ? `${MODEL_URI}.partial` : null;

type ModelState =
  'checking' | 'ready' | 'preparing' | 'downloading' | 'downloaded' | 'unavailable' | 'error';

const formatStorage = (bytes: number) =>
  bytes >= 1_000_000_000
    ? `${(bytes / 1_000_000_000).toFixed(2)} GB`
    : `${Math.round(bytes / 1_000_000)} MB`;

export function GemmaModelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [state, setState] = useState<ModelState>(() =>
    Platform.OS === 'web' || !MODEL_URI ? 'unavailable' : 'checking',
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const task = useRef<FileSystem.DownloadResumable | null>(null);
  const mounted = useRef(false);
  const cancelRequested = useRef(false);
  const lastProgressUpdate = useRef(0);

  useEffect(() => {
    mounted.current = true;
    if (Platform.OS !== 'web' && MODEL_URI) {
      void FileSystem.getInfoAsync(MODEL_URI)
        .then((info) => {
          if (mounted.current) {
            setState(info.exists && (info.size ?? 0) >= MODEL_BYTES ? 'downloaded' : 'ready');
          }
        })
        .catch(() => {
          if (mounted.current) setState('ready');
        });
    }

    return () => {
      mounted.current = false;
    };
  }, []);

  const downloadModel = async () => {
    if (!MODEL_DIRECTORY || !MODEL_URI || !PARTIAL_URI || Platform.OS === 'web') {
      setState('unavailable');
      return;
    }

    cancelRequested.current = false;
    lastProgressUpdate.current = 0;
    setError(null);
    setProgress(0);
    setState('preparing');

    let activeTask: FileSystem.DownloadResumable | null = null;

    try {
      const freeBytes = await FileSystem.getFreeDiskStorageAsync();
      if (freeBytes < MINIMUM_FREE_BYTES) {
        throw new Error(
          'Please free up space first. Keep at least 3 GB available for this download.',
        );
      }

      const directoryInfo = await FileSystem.getInfoAsync(MODEL_DIRECTORY);
      if (!directoryInfo.exists) {
        await FileSystem.makeDirectoryAsync(MODEL_DIRECTORY, { intermediates: true });
      }
      await FileSystem.deleteAsync(PARTIAL_URI, { idempotent: true });
      await FileSystem.deleteAsync(MODEL_URI, { idempotent: true });

      activeTask = FileSystem.createDownloadResumable(
        MODEL_URL,
        PARTIAL_URI,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (!mounted.current) return;
          const total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : MODEL_BYTES;
          const nextProgress = Math.min(1, totalBytesWritten / total);
          const now = Date.now();
          if (now - lastProgressUpdate.current >= 300 || nextProgress >= 1) {
            lastProgressUpdate.current = now;
            setProgress(nextProgress);
          }
        },
      );
      task.current = activeTask;
      if (mounted.current) setState('downloading');

      const result = await activeTask.downloadAsync();
      if (!result || cancelRequested.current) return;
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`The model host returned HTTP ${result.status}.`);
      }

      const downloadedFile = await FileSystem.getInfoAsync(PARTIAL_URI);
      if (!downloadedFile.exists || (downloadedFile.size ?? 0) < MODEL_BYTES) {
        throw new Error('The model download was incomplete. Check your connection and try again.');
      }

      await FileSystem.moveAsync({ from: PARTIAL_URI, to: MODEL_URI });
      if (mounted.current) {
        setProgress(1);
        setState('downloaded');
      }
    } catch (e) {
      if (cancelRequested.current) return;
      await FileSystem.deleteAsync(PARTIAL_URI, { idempotent: true }).catch(() => undefined);
      if (mounted.current) {
        setError(
          e instanceof Error ? e.message : 'The model could not be downloaded. Please try again.',
        );
        setState('error');
      }
    } finally {
      if (task.current === activeTask) task.current = null;
    }
  };

  const confirmDownload = () => {
    Alert.alert(
      'Download Gemma 4 E2B?',
      'This uses about 2.6 GB of data and needs at least 3 GB free. Wi-Fi is recommended.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => void downloadModel() },
      ],
    );
  };

  const cancelDownload = async () => {
    const activeTask = task.current;
    if (!activeTask) return;
    cancelRequested.current = true;
    task.current = null;
    await activeTask.cancelAsync().catch(() => undefined);
    if (PARTIAL_URI) {
      await FileSystem.deleteAsync(PARTIAL_URI, { idempotent: true }).catch(() => undefined);
    }
    if (mounted.current) {
      setProgress(0);
      setState('ready');
    }
  };

  const removeModel = () => {
    if (!MODEL_URI) return;
    Alert.alert('Remove Gemma 4 E2B?', 'This frees about 2.6 GB on this phone.', [
      { text: 'Keep model', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void FileSystem.deleteAsync(MODEL_URI, { idempotent: true })
            .then(() => {
              if (mounted.current) setState('ready');
            })
            .catch(() => {
              Alert.alert('Could not remove the model', 'Please try again.');
            });
        },
      },
    ]);
  };

  const progressText = `${Math.round(progress * 100)}% · ${formatStorage(progress * MODEL_BYTES)} of ${formatStorage(MODEL_BYTES)}`;

  return (
    <Sheet open={visible} onClose={onClose}>
      <View style={styles.heading}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" style={{ fontSize: 11 }}>
            CHAT SETTINGS
          </Text>
          <Text variant="heading">On-device model</Text>
        </View>
        <IconButton icon="close" label="Close chat settings" onPress={onClose} />
      </View>

      <View style={styles.modelCard}>
        <Text variant="strong">Gemma 4 E2B · LiteRT</Text>
        <Text variant="small">
          Download the model file to this phone. It is about 2.59 GB; Wi-Fi is recommended.
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          Downloading the file does not change Ginto’s replies yet.
        </Text>
      </View>

      {state === 'checking' ? <Text variant="caption">Checking this phone…</Text> : null}

      {state === 'preparing' ? <Text variant="caption">Checking free space…</Text> : null}

      {state === 'unavailable' ? (
        <Text variant="small">Model downloads are available in the iOS and Android app.</Text>
      ) : null}

      {state === 'ready' || state === 'error' ? (
        <>
          {error ? (
            <Text variant="small" color={colors.error}>
              {error}
            </Text>
          ) : null}
          <Button
            label={state === 'error' ? 'Try download again · 2.59 GB' : 'Download model · 2.59 GB'}
            onPress={confirmDownload}
            disabled={Platform.OS === 'web'}
            icon="device"
          />
        </>
      ) : null}

      {state === 'downloading' ? (
        <View style={styles.progressGroup}>
          <ProgressBar value={progress} height={10} />
          <Text variant="caption">Downloading · {progressText}</Text>
          <Button
            label="Cancel download"
            kind="ghost"
            size="sm"
            onPress={() => void cancelDownload()}
          />
        </View>
      ) : null}

      {state === 'downloaded' ? (
        <View style={styles.downloadedGroup}>
          <Text variant="small" color={colors.success}>
            Saved on this phone · {formatStorage(MODEL_BYTES)}
          </Text>
          <Button label="Remove downloaded model" kind="ghost" size="sm" onPress={removeModel} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = {
  heading: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  modelCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  progressGroup: { gap: spacing.sm },
  downloadedGroup: { gap: spacing.xs },
};
