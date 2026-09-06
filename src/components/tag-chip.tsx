import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small">{label}</ThemedText>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {' '}
            ×
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
});
