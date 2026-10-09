import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { buildEvidencePdfHtml } from '@/domain/evidence';
import type { Evidence } from '@/domain/types';

import { evidenceImageDataUri } from './evidenceFiles';

export async function exportEvidencePack(items: Evidence[]): Promise<void> {
  if (!items.length) throw new Error('Add a record before exporting.');
  if (Platform.OS === 'web') throw new Error('PDF export is available in the phone app.');
  const prepared = await Promise.all(
    items.map(async (evidence) => ({
      evidence,
      imageDataUri: evidence.imageUri ? await evidenceImageDataUri(evidence.imageUri) : null,
    })),
  );
  const printed = await Print.printToFileAsync({ html: buildEvidencePdfHtml(prepared) });
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(printed.uri, { mimeType: 'application/pdf', UTI: '.pdf' });
}
