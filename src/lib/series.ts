import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { normalizeKey } from '@/lib/themes';

export type Series = {
  id: string;
  /** The theme this belongs to — a series name only means anything inside one. */
  themeId: string;
  name: string;
  /** Release year, to tell a reissue from the original run of the same name. */
  year: number | null;
  createdAt: number;
};

function seriesCollection() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return collection(db, 'users', uid, 'series');
}

function fromDoc(snap: QueryDocumentSnapshot<DocumentData>): Series {
  const data = snap.data();
  return {
    id: snap.id,
    themeId: data.themeId,
    name: data.name,
    year: typeof data.year === 'number' ? data.year : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
  };
}

/**
 * Every series, across all themes.
 *
 * Fetched whole rather than queried per theme: the screens that need it already
 * hold the full theme list for the same reason, and a personal catalog has tens of
 * series, not thousands. Filtering by theme happens in memory.
 */
export async function listSeries(): Promise<Series[]> {
  const snap = await getDocs(query(seriesCollection(), orderBy('name')));
  return snap.docs.map(fromDoc);
}

export async function createSeries(themeId: string, name: string, year: number | null = null): Promise<string> {
  const ref = doc(seriesCollection());
  await setDoc(ref, {
    themeId,
    name: name.trim(),
    // Same normalization as themes so "草莓派對系列" and "草莓派對系列 " are one entry.
    matchKey: normalizeKey(name),
    year,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSeries(id: string, name: string, year: number | null): Promise<void> {
  await updateDoc(doc(seriesCollection(), id), {
    name: name.trim(),
    matchKey: normalizeKey(name),
    year,
  });
}

export async function deleteSeries(id: string): Promise<void> {
  await deleteDoc(doc(seriesCollection(), id));
}

/**
 * Finds the series a free-text name refers to within a set of themes — the AI's
 * answer, or something typed. Returns null when nothing matches, which is the
 * caller's cue to offer creating it rather than doing so silently.
 *
 * Matched in memory against an already-loaded list: the caller is picking from
 * exactly these entries on screen, so a round trip would only add latency.
 */
export function findSeriesByName(all: Series[], themeIds: string[], name: string): Series | null {
  const key = normalizeKey(name);
  if (!key) return null;
  return (
    all.find((s) => themeIds.includes(s.themeId) && normalizeKey(s.name) === key) ?? null
  );
}
