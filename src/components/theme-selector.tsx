import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Theme } from '@/lib/themes';

// Themes are multi-valued so a collaboration piece (拉拉熊 × 三麗鷗) stays findable
// under both (SPEC.md §1). Every existing theme is one tap away, so only a genuinely
// new one needs typing — that is what keeps "拉拉熊" from splitting into three
// near-identical spellings.
export function ThemeSelector({
  value,
  themes,
  onChange,
  onCreate,
}: {
  /** Selected theme ids. */
  value: string[];
  /** Every theme in the catalog. */
  themes: Theme[];
  onChange: (themeIds: string[]) => void;
  /** Creates a theme and returns its id. */
  onCreate: (name: string) => Promise<string>;
}) {
  const palette = useTheme();
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = themes.filter((t) => value.includes(t.id));
  const unpicked = themes.filter((t) => !value.includes(t.id));

  // A theme whose name or aliases already cover what's typed — offered as a tap
  // instead of letting a second "拉拉熊" be created.
  const typed = draft.trim();
  const duplicate = typed
    ? themes.find((t) =>
        [t.name, ...t.aliases].some((n) => n.toLowerCase() === typed.toLowerCase()),
      )
    : undefined;

  async function commitDraft() {
    if (!typed || creating) return;
    if (duplicate) {
      if (!value.includes(duplicate.id)) onChange([...value, duplicate.id]);
      setDraft('');
      return;
    }
    setCreating(true);
    try {
      const id = await onCreate(typed);
      onChange([...value, id]);
      setDraft('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      {selected.length > 0 && (
        <View style={styles.row}>
          {selected.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onChange(value.filter((id) => id !== t.id))}
              style={[styles.chip, { backgroundColor: palette.accent }]}>
              <ThemedText type="small" themeColor="onAccent">
                {t.name} ×
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      {unpicked.length > 0 && (
        <View style={styles.row}>
          {unpicked.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onChange([...value, t.id])}
              style={[styles.chip, { backgroundColor: palette.backgroundElement }]}>
              <ThemedText type="small">{t.name}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commitDraft}
        placeholder="找不到就打字新增，例：拉拉熊"
        placeholderTextColor={palette.textSecondary}
        editable={!creating}
        style={[styles.input, { color: palette.text, backgroundColor: palette.backgroundElement }]}
      />

      {typed !== '' && (
        <Pressable onPress={commitDraft} disabled={creating} style={styles.confirm}>
          <ThemedText type="small" themeColor="textSecondary">
            {creating
              ? '建立中…'
              : duplicate
                ? `已有「${duplicate.name}」，點這裡選它`
                : `建立新主題「${typed}」`}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
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
  confirm: { paddingVertical: Spacing.one },
});
