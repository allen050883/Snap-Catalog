import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { typeLabel } from '@/constants/item-types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ItemWithTags } from '@/lib/db';

export type DraftSummary = {
  name: string;
  thumbnail: string | null;
  size: string;
  color: string;
};

/**
 * Side-by-side view of the item being added and the one already in the catalog.
 *
 * The matched fields are stated rather than implied — the point is to show *why*
 * this was flagged, so a false positive is obvious at a glance. The differing
 * fields sit underneath, because those are what the decision actually turns on:
 * the same series in another size is a different piece, not a duplicate.
 */
export function DuplicateCompare({
  draft,
  existing,
  themeNames,
  onKeepAdding,
  onDiscard,
  onIncrement,
}: {
  draft: DraftSummary;
  existing: ItemWithTags;
  themeNames: string[];
  onKeepAdding: () => void;
  onDiscard: () => void;
  onIncrement: () => void;
}) {
  const palette = useTheme();
  const shared = [themeNames.join(' × '), existing.series, typeLabel(existing.type)]
    .filter(Boolean)
    .join(' · ');

  const differences = [
    { label: '尺寸', a: draft.size || '—', b: existing.size || '—' },
    { label: '顏色', a: draft.color || '—', b: existing.color || '—' },
  ].filter((d) => d.a !== d.b);

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.accent }]}>
      <View style={[styles.head, { backgroundColor: palette.backgroundElement }]}>
        <ThemedText type="smallBold">這件收藏可能已經有了</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          主題、系列和類型都相同
        </ThemedText>
      </View>

      <View style={styles.pair}>
        <Side label="這次辨識" uri={draft.thumbnail} name={draft.name || '未命名'} />
        <Side label="收藏庫已有" uri={existing.thumbnail} name={existing.name} />
      </View>

      <View style={[styles.facts, { borderTopColor: palette.backgroundSelected }]}>
        <View style={styles.factRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.factLabel}>
            相同
          </ThemedText>
          <ThemedText type="small" style={styles.factValue}>
            {shared}
          </ThemedText>
        </View>
        {differences.map((d) => (
          <View key={d.label} style={styles.factRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.factLabel}>
              {d.label}不同
            </ThemedText>
            <ThemedText type="small" style={styles.factValue}>
              {d.a} ↔ {d.b}
            </ThemedText>
          </View>
        ))}
        {differences.length === 0 && (
          <View style={styles.factRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.factLabel}>
              差異
            </ThemedText>
            <ThemedText type="small" style={styles.factValue}>
              填寫的欄位完全一致
            </ThemedText>
          </View>
        )}
      </View>

      <View style={[styles.actions, { borderTopColor: palette.backgroundSelected }]}>
        <Pressable onPress={onKeepAdding} style={styles.ghost}>
          <ThemedText type="small" themeColor="textSecondary">
            不一樣，繼續新增
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onDiscard}
          style={[styles.secondary, { backgroundColor: palette.backgroundSelected }]}>
          <ThemedText type="small">確實重複，不儲存</ThemedText>
        </Pressable>
        <Pressable onPress={onIncrement} style={[styles.primary, { backgroundColor: palette.accent }]}>
          <ThemedText type="smallBold" themeColor="onAccent">
            已有數量 +1
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function Side({ label, uri, name }: { label: string; uri: string | null; name: string }) {
  const palette = useTheme();
  return (
    <View style={styles.side}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.photo, { backgroundColor: palette.backgroundSelected }]}>
        {uri && <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />}
      </View>
      <ThemedText type="smallBold" numberOfLines={2}>
        {name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, borderWidth: 1, overflow: 'hidden' },
  head: { padding: Spacing.three, gap: 2 },
  pair: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three },
  side: { flex: 1, gap: Spacing.one },
  photo: { width: '100%', aspectRatio: 1, borderRadius: Spacing.two, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  facts: { borderTopWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.one },
  factRow: { flexDirection: 'row', gap: Spacing.three },
  factLabel: { width: 64 },
  factValue: { flex: 1 },
  actions: {
    borderTopWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  ghost: { paddingVertical: Spacing.two, alignItems: 'center' },
  secondary: { paddingVertical: Spacing.two + 2, borderRadius: Spacing.two, alignItems: 'center' },
  primary: { paddingVertical: Spacing.two + 2, borderRadius: Spacing.two, alignItems: 'center' },
});
