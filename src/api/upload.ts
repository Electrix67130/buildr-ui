import { getAccessToken } from './client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'change-me-in-production';

interface UploadResult {
  url: string;
  original_name: string;
  file_size: number;
  mime_type: string;
}

/**
 * Upload a file to the API server.
 * Returns a public URL that can be stored in the database.
 */
export async function uploadFile(fileUri: string, fileName: string, mimeType?: string): Promise<UploadResult> {
  const token = await getAccessToken();

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType || 'application/octet-stream',
  } as unknown as Blob);

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Upload failed');
  }

  return response.json();
}
