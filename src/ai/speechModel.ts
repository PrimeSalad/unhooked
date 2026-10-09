import * as FileSystem from 'expo-file-system/legacy';

const SPEECH_FILES = [
  { fileName: 'small-encoder.int8.onnx', bytes: 112_442_483 },
  { fileName: 'small-decoder.int8.onnx', bytes: 262_226_114 },
  { fileName: 'small-tokens.txt', bytes: 816_730 },
] as const;

const STALE_SPEECH_FILES = [
  'base-encoder.int8.onnx',
  'base-decoder.int8.onnx',
  'base-tokens.txt',
];

const REVISION = '8f3c18b358db4d1f2fc1eae49d75cd20989e4309';

export const SPEECH_MODEL_BYTES = SPEECH_FILES.reduce((sum, file) => sum + file.bytes, 0);

export function speechModelDirectory(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}speech/` : null;
}

function speechFileUri(fileName: string): string | null {
  const directory = speechModelDirectory();
  return directory ? `${directory}${fileName}` : null;
}

function speechFileUrl(fileName: string): string {
  return `https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/${REVISION}/${fileName}?download=true`;
}

async function fileReady(uri: string, bytes: number): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  return Boolean(info?.exists && (info.size ?? 0) >= bytes * 0.98);
}

export async function isSpeechModelReady(): Promise<boolean> {
  const checks = await Promise.all(
    SPEECH_FILES.map(async (file) => {
      const uri = speechFileUri(file.fileName);
      return uri != null && (await fileReady(uri, file.bytes));
    }),
  );
  return checks.every(Boolean);
}

export async function ensureSpeechModel(onProgress?: (value: number) => void): Promise<string> {
  const directory = speechModelDirectory();
  if (!directory) throw new Error('Speech storage is not available on this phone.');

  const directoryInfo = await FileSystem.getInfoAsync(directory);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
  await Promise.all(
    STALE_SPEECH_FILES.map((fileName) =>
      FileSystem.deleteAsync(`${directory}${fileName}`, { idempotent: true }).catch(() => undefined),
    ),
  );

  let completed = 0;
  for (const file of SPEECH_FILES) {
    const uri = `${directory}${file.fileName}`;
    if (await fileReady(uri, file.bytes)) {
      completed += file.bytes;
      onProgress?.(completed / SPEECH_MODEL_BYTES);
      continue;
    }
    const partial = `${uri}.partial`;
    await FileSystem.deleteAsync(partial, { idempotent: true });
    const task = FileSystem.createDownloadResumable(
      speechFileUrl(file.fileName),
      partial,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const incoming = totalBytesExpectedToWrite > 0 ? totalBytesWritten : 0;
        onProgress?.((completed + incoming) / SPEECH_MODEL_BYTES);
      },
    );
    const result = await task.downloadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => undefined);
      throw new Error('The Tagalog speech model could not be downloaded.');
    }
    const downloaded = await FileSystem.getInfoAsync(partial);
    if (!downloaded.exists || (downloaded.size ?? 0) < file.bytes * 0.98) {
      await FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => undefined);
      throw new Error('The Tagalog speech download was incomplete. Check your connection and try again.');
    }
    await FileSystem.deleteAsync(uri, { idempotent: true });
    await FileSystem.moveAsync({ from: partial, to: uri });
    completed += file.bytes;
    onProgress?.(Math.min(1, completed / SPEECH_MODEL_BYTES));
  }

  return directory;
}
