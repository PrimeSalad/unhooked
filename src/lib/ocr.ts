// On-device text recognition (ML Kit). Needs the phone app build; elsewhere returns null
// so the screen falls back to pasting text. ML Kit gives no progress, so only stages are reported.

export interface OcrProgress {
  label: string;
  /** 0..1, or null when the reader cannot tell how far along it is. */
  value: number | null;
}

export async function readImageText(
  uri: string,
  onProgress?: (p: OcrProgress) => void,
): Promise<string | null> {
  try {
    onProgress?.({ label: 'Reading the text', value: null });
    const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
    const result = await TextRecognition.recognize(uri);
    onProgress?.({ label: 'Done', value: 1 });
    return result.text.trim() || null;
  } catch {
    return null;
  }
}
