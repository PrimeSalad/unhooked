import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { buildNumberLogFile, parseNumberLogFile } from '@/domain/numberLog';
import type { NumberReport } from '@/domain/types';

const MAX_FILE_BYTES = 20_000_000;

/** Shares a temporary JSON file; screenshots and message text are not included. */
export async function exportNumberLog(reports: NumberReport[]): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Export is available in the phone app.');
  if (!reports.length) throw new Error('Log a number before exporting.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available here.');
  const file = new File(Paths.cache, `unhooked-number-log-${Date.now()}.json`);
  file.create();
  file.write(buildNumberLogFile(reports));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
}

/** Returns null on cancellation; validation runs before callers write anything to SQLite. */
export async function pickNumberLog(): Promise<NumberReport[] | null> {
  if (Platform.OS === 'web') throw new Error('Import is available in the phone app.');
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    DocumentPicker = await import('expo-document-picker');
  } catch {
    throw new Error('File picker is not available in this build.');
  }
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('No file was selected.');
  if (asset.size && asset.size > MAX_FILE_BYTES) throw new Error('This log file is too large.');
  const raw = await new File(asset.uri).text();
  return parseNumberLogFile(raw);
}
