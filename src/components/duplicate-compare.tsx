import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { statusLabel, typeLabel } from '@/constants/item-types';
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
 * Side-by-side view of the item being added and everything in the catalog that
 * looks like it.
 *
 * The matched fields are stated rather than implied — the point is to show *why*
 * each one was flagged, so a false positive is obvious at a glance. Differing
 * fields sit underneath, because those are what the decision turns on: the same
 * series in another size is a different piece, not a duplicate.
 */
export function DuplicateCompare({
  draft,
  matches,
  themeNamesFor,
  onKeepAdding,
  onDiscard,
  onIncrement,
  onMarkOwned,
}: {
  draft: DraftSummary;
  matches: ItemWithTags[];
  themeNamesFor: (item: ItemWithTags) => string[];
  onKeepAdding: () => void;
  onDiscard: () => void;
  onIncrement: (id: string) => void;
  /** Called for a match sitting on the wish list — the piece was finally found. */
  onMarkOwned: (id: string) => void;
}) {
  const palette = useTheme();
  if (matches.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.accent }]}>
      <View style={[styles.head, { backgroundColor: palette.backgroundElement }]}>
        <ThemedText type="smallBold">
          {matches.length === 1 ? '這件收藏可能已經有了' : `找到 ${matches.length} 筆可能重複的收藏`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          主題、系列和類型都相同
        </ThemedText>
      </View>

      {matches.map((existing) => (
        <Match
          key={existing.id}
          draft={draft}
          existing={existing}
          themeNames={themeNamesFor(existing)}
          onIncrement={() => onIncrement(existing.id)}
          onMarkOwned={() => onMarkOwned(existing.id)}
        />
      ))}

      <View style={[styles.actions, { borderTopColor: palette.backgroundSelected }]}>
        <Pressable
          onPress={onDiscard}
          style={[styles.secondary, { backgroundColor: palette.backgroundSelected }]}>
          <ThemedText type="small">確實重複，不儲存</ThemedText>
        </Pressable>
        <Pressable onPress={onKeepAdding} style={styles.ghost}>
          <ThemedText type="small" themeColor="textSecondary">
            都不一樣，繼續新增
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function Match({
  draft,
  existing,
  themeNames,
  onIncrement,
  onMarkOwned,
}: {
  draft: DraftSummary;
  existing: ItemWithTags;
  themeNames: string[];
  onIncrement: () => void;
  onMarkOwned: () => void;
}) {
  const palette = useTheme();
  const wished = existing.status === 'wished';
  const shared = [themeNames.join(' × '), existing.series, typeLabel(existing.type)]
    .filter(Boolean)
    .join(' · ');

  const differences = [
    { label: '尺寸', a: draft.size || '—', b: existing.size || '—' },
    { label: '顏色', a: draft.color || '—', b: existing.color || '—' },
  ].filter((d) => d.a !== d.b);

  return (
    <View style={[styles.match, { borderTopColor: palette.backgroundSelected }]}>
      <View style={styles.pair}>
        <Side label="這次辨識" uri={draft.thumbnail} name={draft.name || '未命名'} />
        <Side
          label="收藏庫已有"
          uri={existing.thumbnail}
          name={existing.name}
          badge={statusLabel(existing.status)}
          badgeHighlighted={wished}
        />
      </View>

      <View style={styles.facts}>
        <Fact label="相同" value={shared} />
        {differences.map((d) => (
          <Fact key={d.label} label={`${d.label}不同`} value={`${d.a} ↔ ${d.b}`} />
        ))}
        {differences.length === 0 && <Fact label="差異" value="填寫的欄位完全一致" />}
      </View>

      {wished ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            這筆在你的「想要」清單裡 —— 買到了就改成已擁有，不用重新建立。
          </ThemedText>
          <Pressable onPress={onMarkOwned} style={[styles.primary, { backgroundColor: palette.accent }]}>
            <ThemedText type="smallBold" themeColor="onAccent">
              改成已擁有
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={onIncrement} style={[styles.primary, { backgroundColor: palette.accent }]}>
          <ThemedText type="smallBold" themeColor="onAccent">
            已有數量 +1
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.factLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.factValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function Side({
  label,
  uri,
  name,
  badge,
  badgeHighlighted,
}: {
  label: string;
  uri: string | null;
  name: string;
  badge?: string | null;
  badgeHighlighted?: boolean;
}) {
  const palette = useTheme();
  return (
    <View style={styles.side}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.photo, { backgroundColor: palette.backgroundSelected }]}>
        {uri && <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />}
        {badge && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: badgeHighlighted ? palette.accent : palette.background },
            ]}>
            <ThemedText type="small" themeColor={badgeHighlighted ? 'onAccent' : 'text'}>
              {badge}
            </ThemedText>
          </View>
        )}
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
  match: { borderTopWidth: 1, padding: Spacing.three, gap: Spacing.three },
  pair: { flexDirection: 'row', gap: Spacing.three },
  side: { flex: 1, gap: Spacing.one },
  photo: { width: '100%', aspectRatio: 1, borderRadius: Spacing.two, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  statusBadge: {
    position: 'absolute',
    left: Spacing.two,
    top: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 999,
    opacity: 0.94,
  },
  facts: { gap: Spacing.one },
  factRow: { flexDirection: 'row', gap: Spacing.three },
  factLabel: { width: 64 },
  factValue: { flex: 1 },
  hint: { opacity: 0.85 },
  actions: { borderTopWidth: 1, padding: Spacing.three, gap: Spacing.two },
  ghost: { paddingVertical: Spacing.two, alignItems: 'center' },
  secondary: { paddingVertical: Spacing.two + 2, borderRadius: Spacing.two, alignItems: 'center' },
  primary: { paddingVertical: Spacing.two + 2, borderRadius: Spacing.two, alignItems: 'center' },
});
