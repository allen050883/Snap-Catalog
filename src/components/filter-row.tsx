import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export type FilterOption = { value: string; label: string };

// One axis of the classification per row (see SPEC.md §1), each scrolling on its own
// so a long theme list never pushes the type row off screen.
export function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  /** null means "全部". */
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View style={styles.row}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="全部" selected={value === null} onPress={() => onChange(null)} />
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(value === option.value ? null : option.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  label: { width: 40 },
  chips: { gap: Spacing.two, paddingRight: Spacing.three },
});
