import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Download a remote file to local cache and open the native share sheet
 * (user can save to Photos, Files, send via AirDrop, email, etc.)
 */
export async function shareFile(url: string, filename: string, mimeType?: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Le partage n\'est pas disponible sur cet appareil');
  }

  // Download to cache
  const cachePath = `${FileSystem.cacheDirectory}${filename}`;
  const download = await FileSystem.downloadAsync(url, cachePath);

  if (download.status !== 200) {
    throw new Error('Échec du téléchargement du fichier');
  }

  await Sharing.shareAsync(download.uri, {
    mimeType: mimeType || 'application/octet-stream',
    dialogTitle: 'Partager le fichier',
    UTI: Platform.OS === 'ios' ? guessUTI(filename, mimeType) : undefined,
  });
}

function guessUTI(filename: string, mimeType?: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (mimeType?.startsWith('image/')) return 'public.image';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'com.adobe.pdf';
  return undefined;
}
