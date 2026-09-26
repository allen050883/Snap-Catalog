import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
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
  /** Free text: "M", "坐姿", "12 cm". Same series in another size is the classic duplicate. */
  size: string | null;
  quantity: number;
  color: string | null;
  notes: string | null;
  photoUri: string | null;
  createdAt: number;
};

export type ItemInput = Omit<Item, 'id' | 'createdAt'>;
export type ItemWithTags = Item & { tags: string[] };

function itemsCollection() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return collection(db, 'users', uid, 'items');
}

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
    photoUri: data.photoUri ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt,
  };
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

export async function createItem(input: ItemInput, tags: string[]): Promise<string> {
  const docRef = await addDoc(itemsCollection(), {
    ...input,
    tags: uniqueTags(tags),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateItem(id: string, input: ItemInput, tags: string[]): Promise<void> {
  await updateDoc(doc(itemsCollection(), id), { ...input, tags: uniqueTags(tags) });
}

export async function deleteItem(id: string): Promise<void> {
  await deleteDoc(doc(itemsCollection(), id));
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
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
  : async () => {};
