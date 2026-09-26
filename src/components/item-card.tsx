import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { typeLabel } from '@/constants/item-types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ItemWithTags } from '@/lib/db';

export function ItemCard({
  item,
  themeNames,
  onPress,
}: {
  item: ItemWithTags;
  /** Display names for item.themeIds, resolved by the caller. */
  themeNames: string[];
  onPress: () => void;
}) {
  const theme = useTheme();
  // "×" rather than "·" between themes: it reads as a collaboration, which is what a
  // multi-theme item always is.
  const subtitle = [themeNames.join(' × '), item.series].filter(Boolean).join(' · ');
  const label = typeLabel(item.type);

  return (
    <Pressable style={[styles.card, { backgroundColor: theme.card }]} onPress={onPress}>
      <View style={[styles.photoWrap, { backgroundColor: theme.backgroundSelected }]}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photoEmpty}>
            <ThemedText type="small" themeColor="textSecondary">
              無照片
            </ThemedText>
          </View>
        )}

        {label && (
          <View style={[styles.typeBadge, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">{label}</ThemedText>
          </View>
        )}

        {item.quantity > 1 && (
          <View style={[styles.qtyBadge, { backgroundColor: theme.text }]}>
            <ThemedText type="smallBold" themeColor="background">
              × {item.quantity}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {item.name}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
        {item.size ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.size}>
            {item.size}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    // Cards lift off the cream ground rather than being outlined — a border at this
    // density turns the grid into a wireframe.
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  photoWrap: { width: '100%', aspectRatio: 1 },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  typeBadge: {
    position: 'absolute',
    left: Spacing.two,
    top: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 999,
    opacity: 0.94,
  },
  qtyBadge: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 999,
  },
  body: { padding: Spacing.two + 2, gap: 2 },
  size: { marginTop: 2 },
});
