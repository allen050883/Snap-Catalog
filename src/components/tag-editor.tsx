import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { TagChip } from '@/components/tag-chip';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const theme = useTheme();

  function commitDraft() {
    const value = draft.trim();
    setDraft('');
    if (!value) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    onChange([...tags, value]);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {tags.map((tag) => (
          <TagChip key={tag} label={tag} onRemove={() => removeTag(tag)} />
        ))}
      </View>
      <TextInput
        value={draft}
        onChangeText={(text) => {
          if (text.endsWith(',') || text.endsWith('\n')) {
            setDraft(text.slice(0, -1));
            commitDraft();
          } else {
            setDraft(text);
          }
        }}
        onSubmitEditing={commitDraft}
        onBlur={commitDraft}
        placeholder="Add a tag and press enter"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
