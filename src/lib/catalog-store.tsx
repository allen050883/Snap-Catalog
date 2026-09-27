import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ItemWithTags, listItems } from '@/lib/db';
import { listSeries, type Series } from '@/lib/series';
import { listThemes, type Theme } from '@/lib/themes';

/**
 * One copy of the catalog, shared by every screen.
 *
 * Each screen used to fetch what it needed on mount or on focus, so opening the add
 * screen and coming back read items, themes and series three times over — nine
 * collection reads for one round trip, with every item's thumbnail among them.
 *
 * Screens now read from here and call `invalidate()` after a write. The next time a
 * screen comes into focus it notices the data is stale and refetches once; a
 * round trip that changed nothing refetches nothing.
 */
type CatalogValue = {
  items: ItemWithTags[];
  themes: Theme[];
  series: Series[];
  /** True only while the first load is in flight — a refresh keeps the old data on screen. */
  loading: boolean;
  /** Fetches now, regardless of staleness. */
  refresh: () => Promise<void>;
  /** Marks the data stale after a write, so the next focus refetches. */
  invalidate: () => void;
  /** Refetches if something has invalidated since the last fetch. Cheap to call on focus. */
  refreshIfStale: () => void;
};

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
  const [items, setItems] = useState<ItemWithTags[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  // Which account the data on hand belongs to. Deriving `loading` from it rather
  // than keeping a separate flag means switching users cannot leave the previous
  // account's catalog on screen looking loaded.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== uid;

  // Refs, not state: changing these must not re-render, and `refreshIfStale` has to
  // read the current value rather than one captured when it was created.
  const stale = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    // Two screens gaining focus together would otherwise fetch the same data twice.
    if (inFlight.current) return inFlight.current;

    const run = (async () => {
      try {
        // In parallel: they are independent, and the slowest one sets the pace.
        const [nextItems, nextThemes, nextSeries] = await Promise.all([
          listItems(),
          listThemes(),
          listSeries(),
        ]);
        setItems(nextItems);
        setThemes(nextThemes);
        setSeries(nextSeries);
        setLoadedFor(uid);
        stale.current = false;
      } catch {
        // Leave whatever is on screen. A failed refresh should not blank the
        // catalog; the screens surface their own errors for actions that matter.
      } finally {
        inFlight.current = null;
      }
    })();

    inFlight.current = run;
    return run;
  }, [uid]);

  const invalidate = useCallback(() => {
    stale.current = true;
  }, []);

  const refreshIfStale = useCallback(() => {
    if (stale.current) void refresh();
  }, [refresh]);

  // Load on mount, and again from scratch whenever the signed-in user changes —
  // `refresh` is rebuilt with the new uid, which is what re-runs this.
  useEffect(() => {
    stale.current = true;
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ items, themes, series, loading, refresh, invalidate, refreshIfStale }),
    [items, themes, series, loading, refresh, invalidate, refreshIfStale],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog 必須在 CatalogProvider 之內使用');
  return value;
}

/** Display names for an item's ids, which is what every screen actually shows. */
export function useCatalogNames() {
  const { themes, series } = useCatalog();
  return useMemo(
    () => ({
      themeName: (id: string) => themes.find((t) => t.id === id)?.name ?? '',
      seriesName: (id: string | null) =>
        id ? (series.find((s) => s.id === id)?.name ?? null) : null,
    }),
    [themes, series],
  );
}
