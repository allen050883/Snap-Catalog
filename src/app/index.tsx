import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TagChip } from '@/components/tag-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ItemWithTags, listItems } from '@/lib/db';

export default function ItemListScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ItemWithTags[]>([]);

  const reload = useCallback((search: string) => {
    listItems(search).then(setItems);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload]),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            reload(text);
          }}
          placeholder="Search name, character, series, tag…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              No items yet. Tap + to add your first one.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push(`/item/${item.id}`)}>
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: theme.backgroundSelected }]} />
              )}
              <View style={styles.cardBody}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                {(item.character || item.series) && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {[item.character, item.series].filter(Boolean).join(' · ')}
                  </ThemedText>
                )}
                <View style={styles.tagRow}>
                  {item.tags.slice(0, 4).map((tag) => (
                    <TagChip key={tag} label={tag} />
                  ))}
                </View>
              </View>
            </Pressable>
          )}
        />

        <Pressable style={[styles.fab, { backgroundColor: theme.text }]} onPress={() => router.push('/add')}>
          <ThemedText type="title" themeColor="background" style={styles.fabLabel}>
            +
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  search: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  card: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.three,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Spacing.one,
  },
  thumbPlaceholder: {},
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.half,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    fontSize: 28,
    lineHeight: 32,
  },
});
