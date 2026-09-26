import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ITEM_TYPES } from '@/constants/item-types';
import { Spacing } from '@/constants/theme';

// The stored value is an English slug (see constants/item-types.ts) — picking from a
// fixed set instead of free text is what lets the list screen's filter row work, and
// it matches the exact set the AI is told to choose from.
export function TypePicker({ value, onChange }: { value: string; onChange: (slug: string) => void }) {
  return (
    <View style={styles.row}>
      {ITEM_TYPES.map((itemType) => (
        <Chip
          key={itemType.slug}
          label={itemType.label}
          selected={itemType.slug === value}
          onPress={() => onChange(itemType.slug === value ? '' : itemType.slug)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
