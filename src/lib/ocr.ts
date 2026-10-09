// On-device text recognition (ML Kit). Needs the phone app build; elsewhere returns null
// so the screen falls back to pasting text.

import { Platform } from 'react-native';

export async function readImageText(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
    const result = await TextRecognition.recognize(uri);
    return result.text.trim() || null;
  } catch {
    return null;
  }
}
