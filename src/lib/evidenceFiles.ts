import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const evidenceDirectory = () => new Directory(Paths.document, 'evidence');
const isInside = (uri: string, directoryUri: string) =>
  uri.startsWith(`${directoryUri.replace(/\/+$/, '')}/`);

export const isAppCacheFile = (uri: string): boolean => isInside(uri, Paths.cache.uri);

export async function saveEvidenceImage(
  sourceUri: string,
  id: string,
  mimeType: string | null,
): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Screenshot storage is available in the phone app.');
  const extension =
    mimeType === 'image/png' || /\.png(?:\?|$)/i.test(sourceUri)
      ? 'png'
      : mimeType === 'image/jpeg' || /\.jpe?g(?:\?|$)/i.test(sourceUri)
        ? 'jpg'
        : null;
  if (!extension) throw new Error('Choose a PNG or JPEG screenshot.');
  const directory = evidenceDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const target = new File(directory, `${id}.${extension}`);
  await new File(sourceUri).copy(target);
  return target.uri;
}

export function deleteEvidenceImage(uri: string | null): void {
  if (!uri || Platform.OS === 'web') return;
  const directory = evidenceDirectory();
  const appOwned = isInside(uri, directory.uri) || isAppCacheFile(uri);
  if (!appOwned) return; // never delete a gallery original or arbitrary file
  const file = new File(uri);
  if (file.exists) file.delete();
}

/** Only this app-owned folder is removed; gallery originals remain untouched. */
export function deleteAllEvidenceImages(): void {
  if (Platform.OS === 'web') return;
  const directory = evidenceDirectory();
  if (directory.exists) directory.delete();
}

export async function evidenceImageDataUri(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const directory = evidenceDirectory();
  if (!isInside(uri, directory.uri) && !isAppCacheFile(uri)) return null;
  const file = new File(uri);
  if (!file.exists) return null;
  const mime = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${await file.base64()}`;
}
