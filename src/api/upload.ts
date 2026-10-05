import { getAccessToken, refreshAccessToken } from './client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'change-me-in-production';

interface UploadResult {
  url: string;
  /** Miniature ~400 px generee par l'API. Absente pour les fichiers non images. */
  thumbnail_url?: string;
  original_name: string;
  file_size: number;
  mime_type: string;
}

/**
 * Upload a file to the API server.
 * Returns a public URL that can be stored in the database.
 */
export async function uploadFile(fileUri: string, fileName: string, mimeType?: string): Promise<UploadResult> {
  const send = async (token: string | null) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType || 'application/octet-stream',
    } as unknown as Blob);
    return fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
  };

  let response = await send(await getAccessToken());
  // Jeton d'acces perime : on le renouvelle et on rejoue, comme apiFetch.
  // Sans cela, la file hors ligne finissait en erreur apres cinq essais.
  if (response.status === 401) {
    response = await send(await refreshAccessToken());
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Upload failed');
  }

  return response.json();
}
