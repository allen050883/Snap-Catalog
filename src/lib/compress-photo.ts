import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Firestore documents cap out at 1 MiB total and there is no file storage in this
// project (see README), so photos live as base64 on documents. Two sizes, because
// the list screen reads every item it shows: a full-size photo on each item document
// meant opening the list re-downloaded the entire catalog's photos — roughly 20 MB at
// a hundred items. The thumbnail rides on the item, the full photo lives in its own
// document and is fetched only when a detail screen opens.
const FULL_WIDTH = 1000;
const FULL_QUALITY = 0.6;

// The grid renders cards around 160pt wide, so 320px covers a 2x display with room
// to spare while keeping each thumbnail in the tens of kilobytes.
const THUMB_WIDTH = 320;
const THUMB_QUALITY = 0.5;

export type CompressedPhoto = {
  /** Full-size data URI for users/{uid}/photos/{itemId}. */
  full: string;
  /** Small data URI stored on the item document itself. */
  thumbnail: string;
};

async function render(sourceUri: string, width: number, compress: number): Promise<string> {
  const image = await ImageManipulator.manipulate(sourceUri).resize({ width }).renderAsync();
  const result = await image.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) {
    throw new Error('Image compression did not return base64 data');
  }
  return `data:image/jpeg;base64,${result.base64}`;
}

export async function compressPhoto(sourceUri: string): Promise<CompressedPhoto> {
  // Sequential rather than parallel: ImageManipulator works on native image memory,
  // and two full-resolution decodes at once is a real risk on an older phone.
  const full = await render(sourceUri, FULL_WIDTH, FULL_QUALITY);
  const thumbnail = await render(sourceUri, THUMB_WIDTH, THUMB_QUALITY);
  return { full, thumbnail };
}
