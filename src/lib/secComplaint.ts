import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { buildSecComplaintHtml, type ComplaintInput } from '@/domain/secComplaint';

export async function exportSecComplaint(input: ComplaintInput): Promise<void> {
  const html = buildSecComplaintHtml(input);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const printed = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(printed.uri, { mimeType: 'application/pdf', UTI: '.pdf' });
}
