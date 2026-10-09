/** Blob URLs expire after reload. Store image data with the local SQLite evidence record. */
export async function persistEvidenceImage(uri: string): Promise<string> {
  if (uri.startsWith('data:image/')) return uri;
  if (!uri.startsWith('blob:')) throw new Error('Only a locally selected image can be saved.');
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read this image. Please select it again.'));
    reader.readAsDataURL(blob);
  });
}

// On web, deleting the SQLite evidence records also removes their stored image data.
export async function deleteEvidenceImages(): Promise<void> {}
