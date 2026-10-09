// Web: Tesseract.js reads the screenshot inside the browser. The reader itself (about 10 MB)
// is downloaded once from a CDN; the screenshot never leaves the device.

import type { OcrProgress } from './ocr';

export type { OcrProgress } from './ocr';

const SETUP = 'Getting the text reader ready (first time only)';

export async function readImageText(
  uri: string,
  onProgress?: (p: OcrProgress) => void,
): Promise<string | null> {
  try {
    onProgress?.({ label: SETUP, value: null });
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      // Setup reports no useful progress, so the bar only shows a real percentage while reading.
      logger: (m) => {
        if (m.status === 'recognizing text')
          onProgress?.({ label: 'Reading the text', value: m.progress });
      },
    });
    try {
      const { data } = await worker.recognize(uri);
      onProgress?.({ label: 'Done', value: 1 });
      return data.text.trim() || null;
    } finally {
      await worker.terminate();
    }
  } catch {
    return null;
  }
}
