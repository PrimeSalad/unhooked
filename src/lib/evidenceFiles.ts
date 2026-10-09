import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const evidenceDirectory = () => new Directory(Paths.document, 'unhooked-evidence');

/** Copy picker cache files into app-owned storage before claiming they are saved. */
export async function persistEvidenceImage(uri: string): Promise<string> {
  const directory = evidenceDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const source = new File(uri);
  const extension = /^\.[a-z0-9]+$/i.test(source.extension) ? source.extension : '.jpg';
  const destination = new File(directory, `${Crypto.randomUUID()}${extension}`);
  source.copy(destination);
  return destination.uri;
}

export async function deleteEvidenceImages(): Promise<void> {
  const directory = evidenceDirectory();
  if (directory.exists) directory.delete();
}
