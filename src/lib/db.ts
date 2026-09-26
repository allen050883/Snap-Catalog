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
import { nameSimilarity } from '@/lib/similarity';

export type Item = {
  id: string;
  name: string;
  /**
   * Ids into users/{uid}/themes. Multi-valued so a collaboration (拉拉熊 × 三麗鷗)
   * is findable under either. Ids rather than names so renaming a theme or adding an
   * alias updates every item at once — see lib/themes.ts.
   */
  themeIds: string[];
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
    themeIds: Array.isArray(data.themeIds) ? data.themeIds : [],
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

/**
 * Every item, newest first. Searching and filtering happen on the caller's side: an
 * item stores theme *ids*, so matching a typed "拉拉熊" needs the theme list, which
 * the list screen already holds. A personal catalog is small enough that filtering
 * in memory beats maintaining composite indexes for it.
 */
export async function listItems(): Promise<ItemWithTags[]> {
  const snap = await getDocs(query(itemsCollection(), orderBy('createdAt', 'desc')));
  return snap.docs.map(fromDoc);
}

/**
 * Whether an item matches a free-text search.
 *
 * @param themeNames Display names for the item's themeIds, resolved by the caller.
 */
export function itemMatches(item: ItemWithTags, needle: string, themeNames: string[]): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return [item.name, item.series, item.type, item.size, item.color, ...themeNames, ...item.tags]
    .filter((field): field is string => Boolean(field))
    .some((field) => field.toLowerCase().includes(q));
}

export async function getItem(id: string): Promise<ItemWithTags | null> {
  const snap = await getDoc(doc(itemsCollection(), id));
  if (!snap.exists()) return null;
  return fromDoc(snap as QueryDocumentSnapshot<DocumentData>);
}

/** The fields a duplicate check compares — everything else is allowed to differ. */
export type DuplicateKey = {
  name: string;
  themeIds: string[];
  series: string | null;
  type: string | null;
};

/**
 * How alike two names must be to count as the same piece when neither side names a
 * series. Chosen from real pairs: the closest miss ("拉拉熊 行李箱" vs "拉拉熊 旅行箱",
 * "凱蒂貓 馬克杯" vs "凱蒂貓 水壺") tops out at 0.60, while the nearest genuine match
 * ("繪畫系列" vs "繪畫主題" of the same suitcase) starts at 0.67.
 */
const NAME_SIMILARITY_THRESHOLD = 0.65;

function normalize(value: string | null): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, '');
}

/**
 * Items that look like the one being added.
 *
 * The rule is SPEC.md §5: share at least one theme, the same type, and the same
 * series. That combination is what actually identifies a piece — two 拉拉熊 plushes
 * from different series are different things, while the same series in another size
 * is the duplicate people actually buy twice. Size and colour are deliberately *not*
 * part of the test: they are the fields most likely to differ between the two, so
 * the compare view shows them rather than filtering on them.
 *
 * An item with no theme or no type is never reported — there is too little to go on,
 * and a false alarm on every untagged row would train the warning away.
 */
export function findPossibleDuplicates(items: ItemWithTags[], draft: DuplicateKey): ItemWithTags[] {
  if (draft.themeIds.length === 0 || !draft.type) return [];
  const draftSeries = normalize(draft.series);

  return items.filter((item) => {
    if (item.type !== draft.type) return false;
    if (!item.themeIds.some((id) => draft.themeIds.includes(id))) return false;

    const itemSeries = normalize(item.series);
    if (itemSeries !== draftSeries) return false;

    // Matching series is strong evidence, but two blanks are not: without this,
    // every 拉拉熊 suitcase with no series entered would flag every other one. When
    // neither side names a series the names have to carry the match instead.
    if (draftSeries === '') {
      return nameSimilarity(item.name, draft.name) >= NAME_SIMILARITY_THRESHOLD;
    }
    return true;
  });
}

/** Moves an item between owned/wished, for when a wished-for piece finally turns up. */
export async function setItemStatus(id: string, status: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(itemsCollection(), id), { status });
  await batch.commit();
}

/** Adds to an existing item's count, for when the "duplicate" is a second purchase. */
export async function incrementQuantity(id: string, by = 1): Promise<void> {
  const ref = doc(itemsCollection(), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('找不到這筆收藏');
  const current = snap.data().quantity;
  const quantity = (typeof current === 'number' && current > 0 ? current : 1) + by;
  const batch = writeBatch(db);
  batch.update(ref, { quantity });
  await batch.commit();
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
      const { MOCK_ITEMS, MOCK_THEMES } = await import('@/lib/mock-data');
      const { createTheme, listThemes } = await import('@/lib/themes');

      // Themes first: items reference them by id. Reuse any that already exist so
      // seeding twice doesn't produce a second "拉拉熊".
      const existing = await listThemes();
      const idByName = new Map(existing.map((t) => [t.name, t.id]));
      for (const { name, aliases } of MOCK_THEMES) {
        if (!idByName.has(name)) idByName.set(name, await createTheme(name, aliases));
      }

      // Sequential rather than Promise.all: createItem stamps createdAt with
      // serverTimestamp(), and writing them in order keeps the list order predictable.
      for (const { item, themeNames, tags } of MOCK_ITEMS) {
        const themeIds = themeNames
          .map((name) => idByName.get(name))
          .filter((id): id is string => Boolean(id));
        await createItem({ ...item, themeIds }, tags);
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
