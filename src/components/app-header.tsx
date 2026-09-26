import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Below this the bar keeps only what you can act on: the mark, and sign out. The
// wordmark and the email are reassurance, not controls, and at phone width they
// squeeze everything else out.
const COMPACT_WIDTH = 600;

export function AppHeader({
  email,
  onManageThemes,
  onSignOut,
}: {
  email: string | null;
  onManageThemes: () => void;
  onSignOut: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < COMPACT_WIDTH;

  return (
    <View style={[styles.bar, { borderBottomColor: theme.backgroundSelected }]}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: theme.accent }]}>
          <Icon name="archive" size={18} color={theme.onAccent} />
        </View>
        {!compact && <ThemedText type="smallBold">Snap Catalog</ThemedText>}
      </View>

      <View style={styles.right}>
        {!compact && email && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.email}>
            {email}
          </ThemedText>
        )}
        <Pressable onPress={onManageThemes} hitSlop={8} style={styles.action}>
          <Icon name="settings" size={16} color={theme.textSecondary} />
          {!compact && (
            <ThemedText type="small" themeColor="textSecondary">
              主題管理
            </ThemedText>
          )}
        </Pressable>
        <Pressable onPress={onSignOut} hitSlop={8} style={styles.action}>
          <Icon name="logout" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            登出
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mark: {
    width: 32,
    height: 32,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexShrink: 1 },
  email: { flexShrink: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
