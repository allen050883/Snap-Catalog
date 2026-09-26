import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Themes are multi-valued so a collaboration piece (拉拉熊 × 三麗鷗) stays findable
// under both (SPEC.md §1). `suggestions` are the themes already in the catalog, so
// picking an existing one is one tap and only a genuinely new theme needs typing —
// that is what keeps "拉拉熊" from splitting into three near-identical spellings.
export function ThemeSelector({
  value,
  suggestions,
  onChange,
}: {
  value: string[];
  suggestions: string[];
  onChange: (themes: string[]) => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');

  const unpicked = suggestions.filter((s) => !value.includes(s));

  function add(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (value.some((v) => v.toLowerCase() === clean.toLowerCase())) return;
    onChange([...value, clean]);
  }

  return (
    <View style={styles.container}>
      {value.length > 0 && (
        <View style={styles.picked}>
          {value.map((name) => (
            <Pressable
              key={name}
              onPress={() => onChange(value.filter((v) => v !== name))}
              style={[styles.chip, { backgroundColor: theme.accent }]}>
              <ThemedText type="small" themeColor="onAccent">
                {name} ×
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      {unpicked.length > 0 && (
        <View style={styles.picked}>
          {unpicked.map((name) => (
            <Pressable
              key={name}
              onPress={() => add(name)}
              style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">{name}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => {
          add(draft);
          setDraft('');
        }}
        onBlur={() => {
          add(draft);
          setDraft('');
        }}
        placeholder="新增主題，例：拉拉熊"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  picked: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
