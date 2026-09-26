import {
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';

export type Item = {
  id: string;
  name: string;
  /** Multi-valued so a collaboration (拉拉熊 × 三麗鷗) is findable under either. */
  themes: string[];
  series: string | null;
  /** Slug from constants/item-types.ts. */
  type: string | null;
  /** Slug from constants/item-types.ts STATUSES. */
  status: string;
  /** Free text: "M", "坐姿", "12 公分". Same series in another size is the classic duplicate. */
  size: string | null;
  quantity: number;
  color: string | null;
  notes: string | null;
  /**
   * Small image shown in the grid and as the detail screen's first paint. A data URI
   * for a captured photo, or a remote URL for the sample rows. The full-size photo
   * lives in its own document — see `photosCollection` below.
   */
  thumbnail: string | null;
  /** Whether users/{uid}/photos/{id} exists, so the detail screen knows to fetch it. */
  hasPhoto: boolean;
  createdAt: number;
};

export type ItemInput = Omit<Item, 'id' | 'createdAt' | 'hasPhoto'>;
export type ItemWithTags = Item & { tags: string[] };

function userCollection(name: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return collection(db, 'users', uid, name);
}

const itemsCollection = () => userCollection('items');

/**
 * Full-size photos, keyed by their item's id.
 *
 * They are kept out of the item document because the list screen reads every item
 * it shows: with a full photo on each one, opening the list re-downloaded the whole
 * catalog's images — on the order of 20 MB at a hundred items. Sharing the item's id
 * means fetching one needs no query, just a document read.
 */
const photosCollection = () => userCollection('photos');

function fromDoc(snap: QueryDocumentSnapshot<DocumentData>): ItemWithTags {
  const data = snap.data();
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
  return {
    id: snap.id,
    name: data.name,
    themes: Array.isArray(data.themes) ? data.themes : [],
    series: data.series ?? null,
    type: data.type ?? null,
    status: data.status ?? 'owned',
    size: data.size ?? null,
    quantity: typeof data.quantity === 'number' && data.quantity > 0 ? data.quantity : 1,
    color: data.color ?? null,
    notes: data.notes ?? null,
    thumbnail: data.thumbnail ?? null,
    hasPhoto: data.hasPhoto === true,
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt,
  };
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

/**
 * @param fullPhoto Full-size data URI to store alongside the item. Omit to leave any
 *   existing photo document untouched on update, or to create an item without one.
 */
export async function createItem(input: ItemInput, tags: string[], fullPhoto?: string): Promise<string> {
  // The id is generated client-side so the item and its photo can be written in one
  // batch — otherwise an interrupted save could leave a photo with no item.
  const ref = doc(itemsCollection());
  const batch = writeBatch(db);
  batch.set(ref, {
    ...input,
    hasPhoto: Boolean(fullPhoto),
    tags: uniqueTags(tags),
    createdAt: serverTimestamp(),
  });
  if (fullPhoto) {
    batch.set(doc(photosCollection(), ref.id), { base64: fullPhoto, createdAt: serverTimestamp() });
  }
  await batch.commit();
  return ref.id;
}

export async function updateItem(
  id: string,
  input: ItemInput,
  tags: string[],
  fullPhoto?: string,
): Promise<void> {
  const batch = writeBatch(db);
  const fields: Record<string, unknown> = { ...input, tags: uniqueTags(tags) };
  if (fullPhoto) {
    fields.hasPhoto = true;
    batch.set(doc(photosCollection(), id), { base64: fullPhoto, createdAt: serverTimestamp() });
  }
  batch.update(doc(itemsCollection(), id), fields);
  await batch.commit();
}

export async function deleteItem(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(itemsCollection(), id));
  // Unconditional: deleting a document that was never created is a no-op in
  // Firestore, and this way a stale hasPhoto flag can't orphan an image.
  batch.delete(doc(photosCollection(), id));
  await batch.commit();
}

/** Full-size photo for an item, or null if it has none. */
export async function getItemPhoto(id: string): Promise<string | null> {
  const snap = await getDoc(doc(photosCollection(), id));
  if (!snap.exists()) return null;
  const base64 = snap.data().base64;
  return typeof base64 === 'string' ? base64 : null;
}

export async function listItems(search?: string): Promise<ItemWithTags[]> {
  const snap = await getDocs(query(itemsCollection(), orderBy('createdAt', 'desc')));
  const items = snap.docs.map(fromDoc);

  const needle = search?.trim().toLowerCase();
  if (!needle) return items;

  return items.filter((item) =>
    [item.name, item.series, item.type, item.size, item.color, ...item.themes, ...item.tags]
      .filter((field): field is string => Boolean(field))
      .some((field) => field.toLowerCase().includes(needle)),
  );
}

export async function getItem(id: string): Promise<ItemWithTags | null> {
  const snap = await getDoc(doc(itemsCollection(), id));
  if (!snap.exists()) return null;
  return fromDoc(snap as QueryDocumentSnapshot<DocumentData>);
}

/**
 * Fills the catalog with sample rows so the layout can be reviewed without spending
 * AI quota, and empties it again. Development only.
 *
 * The `__DEV__` test is at module scope, not inside the function: with it inside,
 * Metro still emitted the sample data as its own 3.7KB chunk in a production build
 * (the dynamic import is resolved when the module graph is built, before the dead
 * branch is eliminated). Picking the implementation up here means the release build
 * keeps only the no-op arm, and the data never enters the graph at all.
 */
export const seedMockItems: () => Promise<void> = __DEV__
  ? async () => {
      const { MOCK_ITEMS } = await import('@/lib/mock-data');
      // Sequential rather than Promise.all: createItem stamps createdAt with
      // serverTimestamp(), and writing them in order keeps the list order predictable.
      for (const { item, tags } of MOCK_ITEMS) {
        await createItem(item, tags);
      }
    }
  : async () => {};

/** Development only — deletes every item in the signed-in user's catalog. */
export const clearAllItems: () => Promise<void> = __DEV__
  ? async () => {
      const snap = await getDocs(itemsCollection());
      await Promise.all(snap.docs.map((d) => deleteItem(d.id)));
    }
  : async () => {};
