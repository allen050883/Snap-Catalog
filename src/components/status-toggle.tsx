import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BROWSABLE_STATUSES, statusLabel } from '@/constants/item-types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Owned vs wished is a mode, not a filter: they answer different questions ("do I
// already have this?" / "what am I still after?"), so they get a segmented control
// instead of joining the chip rows below. It spans the full width — at this size the
// two halves read as one switch, where a hugging pill would read as two more chips.
export function StatusToggle({ value, onChange }: { value: string; onChange: (status: string) => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {BROWSABLE_STATUSES.map((slug) => {
        const selected = slug === value;
        return (
          <Pressable
            key={slug}
            onPress={() => onChange(slug)}
            style={[styles.segment, selected && [styles.selected, { backgroundColor: theme.card }]]}>
            <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
              {statusLabel(slug)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Spacing.two + 2,
    gap: Spacing.one,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  selected: {
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
});
