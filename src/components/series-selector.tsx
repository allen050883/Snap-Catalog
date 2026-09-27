import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Series } from '@/lib/series';

/**
 * Picks one series from the themes currently selected.
 *
 * A series name only means something inside its theme — "森林系列" is a different
 * collection for 拉拉熊 than for 吉伊卡哇 — so the choices follow the theme picker
 * above, and nothing can be created until a theme exists to attach it to.
 */
export function SeriesSelector({
  value,
  series,
  themeIds,
  onChange,
  onCreate,
}: {
  /** Selected series id, or null. */
  value: string | null;
  /** Every series in the catalog. */
  series: Series[];
  /** Themes currently picked for the item. */
  themeIds: string[];
  onChange: (seriesId: string | null) => void;
  /** Creates a series under the given theme and returns its id. */
  onCreate: (themeId: string, name: string) => Promise<string>;
}) {
  const palette = useTheme();
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const available = series.filter((s) => themeIds.includes(s.themeId));
  const typed = draft.trim();
  const duplicate = typed
    ? available.find((s) => s.name.toLowerCase() === typed.toLowerCase())
    : undefined;

  if (themeIds.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        先選主題，才能選系列。
      </ThemedText>
    );
  }

  async function commitDraft() {
    if (!typed || creating) return;
    if (duplicate) {
      onChange(duplicate.id);
      setDraft('');
      return;
    }
    setCreating(true);
    try {
      // Attached to the first selected theme: for a collaboration the series
      // belongs to whichever side the user picked first, which is the one they were
      // thinking of. Reassigning it later is a rename away in 主題管理.
      const id = await onCreate(themeIds[0], typed);
      onChange(id);
      setDraft('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      {available.length > 0 && (
        <View style={styles.row}>
          {available.map((s) => {
            const selected = s.id === value;
            return (
              <Pressable
                key={s.id}
                onPress={() => onChange(selected ? null : s.id)}
                style={[
                  styles.chip,
                  { backgroundColor: selected ? palette.accent : palette.backgroundElement },
                ]}>
                <ThemedText type="small" themeColor={selected ? 'onAccent' : 'text'}>
                  {s.name}
                  {s.year ? ` ${s.year}` : ''}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commitDraft}
        placeholder="找不到就打字新增，例：草莓派對系列"
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
                : `建立新系列「${typed}」`}
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
