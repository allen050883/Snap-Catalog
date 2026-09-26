import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Firestore documents cap out at 1 MiB total, and photos are stored as a base64
// string right on the item document (no separate file storage — see README).
// Resizing to a modest width keeps a typical photo's base64 form well under that,
// with plenty of headroom for the other text fields on the same document.
const MAX_WIDTH = 1000;
const JPEG_QUALITY = 0.6;

export async function compressPhotoToBase64(sourceUri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(sourceUri).resize({ width: MAX_WIDTH }).renderAsync();
  const result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) {
    throw new Error('Image compression did not return base64 data');
  }
  return result.base64;
}
