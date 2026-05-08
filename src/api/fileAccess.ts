import { apiFetch } from './client';

/**
 * Get a signed temporary URL to access a file.
 * The URL is valid for 5 minutes and doesn't require API key or auth headers.
 */
export async function getSignedFileUrl(fileUrl: string): Promise<string> {
  // Extract filename from the URL (e.g. "http://host/files/abc-123.pdf" → "abc-123.pdf")
  const filename = fileUrl.split('/').pop();
  if (!filename) throw new Error('Invalid file URL');

  const result = await apiFetch<{ url: string }>(`/files/token/${filename}`);
  return result.url;
}
