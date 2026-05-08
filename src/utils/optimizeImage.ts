import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1920;
const JPEG_QUALITY = 0.7;

export interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize?: number;
}

/**
 * Resize and compress an image to keep storage reasonable while staying readable.
 * - Downscales to max 1920px on longest side
 * - Compresses to JPEG quality 70%
 * Typical reduction: 5-15 MB → 300-800 KB
 */
export async function optimizeImage(uri: string, originalWidth?: number, originalHeight?: number): Promise<OptimizedImage> {
  const actions: ImageManipulator.Action[] = [];

  // Resize if we know dimensions and they exceed MAX_WIDTH
  const longestSide = Math.max(originalWidth ?? 0, originalHeight ?? 0);
  if (longestSide > MAX_WIDTH) {
    if ((originalWidth ?? 0) >= (originalHeight ?? 0)) {
      actions.push({ resize: { width: MAX_WIDTH } });
    } else {
      actions.push({ resize: { height: MAX_WIDTH } });
    }
  } else if (!originalWidth || !originalHeight) {
    // If dimensions unknown, still cap at MAX_WIDTH just in case
    actions.push({ resize: { width: MAX_WIDTH } });
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: 'image/jpeg',
  };
}
