import {
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
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';

export type Theme = {
  id: string;
  name: string;
  /** Other spellings of the same IP: ["Rilakkuma", "リラックマ"]. */
  aliases: string[];
  createdAt: number;
};

function themesCollection() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return collection(db, 'users', uid, 'themes');
}

/**
 * Firestore has no case-insensitive comparison and no substring matching, so every
 * spelling a theme answers to is stored pre-normalized in `matchKeys` and looked up
 * with array-contains. Without it the model returning "拉拉熊 Rilakkuma" would not
 * match a theme the user named "拉拉熊", and the list would grow a near-duplicate.
 *
 * Whitespace is dropped rather than collapsed because the AI's combined form
 * ("拉拉熊 Rilakkuma") has to reduce to something that also contains each half.
 */
export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').trim();
}

function buildMatchKeys(name: string, aliases: string[]): string[] {
  const parts = [name, ...aliases];
  // Each alias contributes its own key, plus the words inside it, so a theme named
  // "拉拉熊" still matches an AI answer of "拉拉熊 Rilakkuma" and vice versa.
  const expanded = parts.flatMap((part) => [part, ...part.split(/\s+/)]);
  return [...new Set(expanded.map(normalizeKey).filter(Boolean))];
}

function fromDoc(snap: QueryDocumentSnapshot<DocumentData>): Theme {
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
  };
}

export async function listThemes(): Promise<Theme[]> {
  const snap = await getDocs(query(themesCollection(), orderBy('name')));
  return snap.docs.map(fromDoc);
}

export async function getTheme(id: string): Promise<Theme | null> {
  const snap = await getDoc(doc(themesCollection(), id));
  return snap.exists() ? fromDoc(snap as QueryDocumentSnapshot<DocumentData>) : null;
}

export async function createTheme(name: string, aliases: string[] = []): Promise<string> {
  const ref = doc(themesCollection());
  await setDoc(ref, {
    name: name.trim(),
    aliases: aliases.map((a) => a.trim()).filter(Boolean),
    matchKeys: buildMatchKeys(name, aliases),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTheme(id: string, name: string, aliases: string[]): Promise<void> {
  const clean = aliases.map((a) => a.trim()).filter(Boolean);
  await updateDoc(doc(themesCollection(), id), {
    name: name.trim(),
    aliases: clean,
    // Always rebuilt from name + aliases rather than edited directly, so the two can
    // never disagree.
    matchKeys: buildMatchKeys(name, clean),
  });
}

export async function deleteTheme(id: string): Promise<void> {
  await deleteDoc(doc(themesCollection(), id));
}

/**
 * Finds the theme a free-text name refers to — the AI's answer, or something typed.
 * Returns null when nothing matches, which is the caller's cue to ask before
 * creating: the model names an IP for anything character-shaped, confidently and
 * sometimes wrongly, and auto-creating would fill the list with its guesses.
 */
export async function findThemeByName(name: string): Promise<Theme | null> {
  const key = normalizeKey(name);
  if (!key) return null;

  const exact = await getDocs(query(themesCollection(), where('matchKeys', 'array-contains', key)));
  if (!exact.empty) return fromDoc(exact.docs[0]);

  // "拉拉熊 Rilakkuma" won't match as a whole against a theme stored as "拉拉熊", so
  // try the individual words before giving up.
  for (const word of name.split(/\s+/)) {
    const wordKey = normalizeKey(word);
    if (!wordKey) continue;
    const snap = await getDocs(query(themesCollection(), where('matchKeys', 'array-contains', wordKey)));
    if (!snap.empty) return fromDoc(snap.docs[0]);
  }
  return null;
}
