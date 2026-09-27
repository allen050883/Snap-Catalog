import { useFocusEffect, useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { EmptyState } from '@/components/empty-state';
import { FilterRow, type FilterOption } from '@/components/filter-row';
import { Icon } from '@/components/icon';
import { ItemCard } from '@/components/item-card';
import { ScreenContainer } from '@/components/screen-container';
import { StatusToggle } from '@/components/status-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ITEM_TYPES } from '@/constants/item-types';
import { Spacing } from '@/constants/theme';
import { useAuthUser } from '@/hooks/use-auth-user';
import { useTheme } from '@/hooks/use-theme';
import { clearAllItems, itemMatches, ItemWithTags, listItems, seedMockItems } from '@/lib/db';
import { listSeries, type Series } from '@/lib/series';
import { listThemes, type Theme } from '@/lib/themes';
import { auth } from '@/lib/firebase';

export default function ItemListScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuthUser();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('owned');
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [items, setItems] = useState<ItemWithTags[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [seeding, setSeeding] = useState(false);

  // Items store theme ids, so the names shown on cards and matched by the search box
  // come from here.
  const themeName = useCallback(
    (id: string) => themes.find((t) => t.id === id)?.name ?? '',
    [themes],
  );
  const seriesName = useCallback(
    (id: string | null) => (id ? (series.find((s) => s.id === id)?.name ?? null) : null),
    [series],
  );

  const reload = useCallback(() => {
    listItems().then(setItems);
    listThemes().then(setThemes);
    listSeries().then(setSeries);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Everything below is scoped to the current tab, so the filter rows and the count
  // describe what you're actually looking at rather than the whole catalog.
  const inStatus = useMemo(() => items.filter((item) => item.status === status), [items, status]);

  // Only offer filters for values actually present, so no row advertises a bucket
  // that would always come back empty.
  const themeOptions: FilterOption[] = useMemo(() => {
    const present = new Set(inStatus.flatMap((item) => item.themeIds));
    return themes
      .filter((t) => present.has(t.id))
      .map((t) => ({ value: t.id, label: t.name }));
  }, [inStatus, themes]);

  const typeOptions: FilterOption[] = useMemo(() => {
    const present = new Set(inStatus.map((item) => item.type).filter(Boolean));
    return ITEM_TYPES.filter((t) => present.has(t.slug)).map((t) => ({ value: t.slug, label: t.label }));
  }, [inStatus]);

  const visibleItems = useMemo(
    () =>
      inStatus.filter(
        (item) =>
          (!themeFilter || item.themeIds.includes(themeFilter)) &&
          (!typeFilter || item.type === typeFilter) &&
          itemMatches(item, query, [
            ...item.themeIds.map(themeName),
            seriesName(item.seriesId) ?? '',
          ]),
      ),
    [inStatus, themeFilter, typeFilter, query, themeName, seriesName],
  );

  const filtering = Boolean(query || themeFilter || typeFilter);

  function clearFilters() {
    setQuery('');
    setThemeFilter(null);
    setTypeFilter(null);
  }

  // Development only — both helpers are no-ops in a release build (see lib/db.ts).
  async function handleSeed() {
    setSeeding(true);
    try {
      await seedMockItems();
      reload();
    } finally {
      setSeeding(false);
    }
  }

  async function handleClearAll() {
    setSeeding(true);
    try {
      await clearAllItems();
      reload();
    } finally {
      setSeeding(false);
    }
  }

  // FlatList can't change numColumns without remounting, hence the key below.
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;

  // Cards are flex: 1 so they share a row evenly, which also means a partial last row
  // stretches them — five items across four columns gave the fifth a full-width card
  // taller than the viewport. Padding the data to a whole number of rows and
  // rendering the extras as empty space keeps every card the same size.
  const rows = useMemo(() => {
    const remainder = visibleItems.length % columns;
    if (visibleItems.length === 0 || remainder === 0) return visibleItems;
    return [...visibleItems, ...Array<null>(columns - remainder).fill(null)];
  }, [visibleItems, columns]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <AppHeader
          email={user?.email ?? user?.displayName ?? null}
          onManageThemes={() => router.push('/themes')}
          onSignOut={() => signOut(auth)}
        />

        <ScreenContainer>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <ThemedText type="small" themeColor="textSecondary">
                  買之前，先查一下
                </ThemedText>
                <ThemedText type="subtitle">我的收藏</ThemedText>
              </View>
              <View style={[styles.countPill, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {visibleItems.length} 件
                </ThemedText>
              </View>
            </View>

            <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="search" size={18} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="搜尋名稱、主題、系列、顏色或標籤"
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            <StatusToggle value={status} onChange={setStatus} />

            {themeOptions.length > 0 && (
              <FilterRow label="主題" options={themeOptions} value={themeFilter} onChange={setThemeFilter} />
            )}
            {typeOptions.length > 0 && (
              <FilterRow label="類型" options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
            )}
          </View>

          <FlatList
            key={`cols-${columns}`}
            data={rows}
            numColumns={columns}
            keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
            contentContainerStyle={styles.list}
            columnWrapperStyle={styles.column}
            ListEmptyComponent={
              filtering ? (
                <EmptyState
                  icon="search"
                  title="找不到符合的收藏"
                  description="換個關鍵字，或調整上方的主題與類型篩選。"
                  actionLabel="清除搜尋條件"
                  onAction={clearFilters}
                />
              ) : (
                <EmptyState
                  icon="archive"
                  title={status === 'owned' ? '這個清單還是空的' : '還沒有想要的收藏'}
                  description={
                    status === 'owned'
                      ? '按右下角的 ＋，拍下你的第一件收藏。'
                      : '看到想買的先拍起來，之後逛街就查得到。'
                  }
                  actionLabel={__DEV__ ? (seeding ? '載入中…' : '載入範例資料') : undefined}
                  onAction={__DEV__ ? handleSeed : undefined}
                />
              )
            }
            renderItem={({ item }) =>
              item ? (
                <ItemCard
                  item={item}
                  themeNames={item.themeIds.map(themeName).filter(Boolean)}
                  seriesName={seriesName(item.seriesId)}
                  onPress={() => router.push(`/item/${item.id}`)}
                />
              ) : (
                <View style={styles.filler} />
              )
            }
          />

          {__DEV__ && items.length > 0 && (
            <Pressable onPress={handleClearAll} style={styles.devReset} disabled={seeding}>
              <ThemedText type="small" themeColor="textSecondary">
                {seeding ? '清除中…' : '清除全部（僅開發模式）'}
              </ThemedText>
            </Pressable>
          )}

          <Pressable
            style={[styles.fab, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/add')}>
            <Icon name="plus" size={26} color={theme.onAccent} />
          </Pressable>
        </ScreenContainer>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  titleBlock: { flexShrink: 1 },
  countPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    marginBottom: Spacing.one,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  searchInput: { flex: 1, fontSize: 16 },
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six + Spacing.four,
  },
  column: { gap: Spacing.three },
  filler: { flex: 1 },
  devReset: { alignItems: 'center', paddingBottom: Spacing.two },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
});
