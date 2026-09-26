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
  character: string | null;
  series: string | null;
  category: string | null;
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
    character: data.character ?? null,
    series: data.series ?? null,
    category: data.category ?? null,
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
    [item.name, item.character, item.series, item.category, item.color, ...item.tags]
      .filter((field): field is string => Boolean(field))
      .some((field) => field.toLowerCase().includes(needle)),
  );
}

export async function getItem(id: string): Promise<ItemWithTags | null> {
  const snap = await getDoc(doc(itemsCollection(), id));
  if (!snap.exists()) return null;
  return fromDoc(snap as QueryDocumentSnapshot<DocumentData>);
}
