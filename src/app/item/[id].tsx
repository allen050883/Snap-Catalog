import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TagEditor } from '@/components/tag-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteItem, getItem, ItemWithTags, updateItem } from '@/lib/db';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [item, setItem] = useState<ItemWithTags | null>(null);
  const [name, setName] = useState('');
  const [character, setCharacter] = useState('');
  const [series, setSeries] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getItem(id).then((loaded) => {
      if (!loaded) return;
      setItem(loaded);
      setName(loaded.name);
      setCharacter(loaded.character ?? '');
      setSeries(loaded.series ?? '');
      setCategory(loaded.category ?? '');
      setColor(loaded.color ?? '');
      setNotes(loaded.notes ?? '');
      setTags(loaded.tags);
    });
  }, [id]);

  if (!item) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} />
      </ThemedView>
    );
  }

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    try {
      await updateItem(
        item.id,
        {
          name: name.trim(),
          character: character.trim() || null,
          series: series.trim() || null,
          category: category.trim() || null,
          color: color.trim() || null,
          notes: notes.trim() || null,
          photoUri: item.photoUri,
        },
        tags,
      );
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!item) return;
    Alert.alert('Delete item?', `This will remove "${item.name}" from your catalog.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteItem(item.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {item.photoUri && <Image source={{ uri: item.photoUri }} style={styles.photo} />}

          <Field label="Name" value={name} onChangeText={setName} theme={theme} />
          <Field label="Character" value={character} onChangeText={setCharacter} theme={theme} />
          <Field label="Series" value={series} onChangeText={setSeries} theme={theme} />
          <Field label="Category" value={category} onChangeText={setCategory} theme={theme} />
          <Field label="Color" value={color} onChangeText={setColor} theme={theme} />
          <Field label="Notes" value={notes} onChangeText={setNotes} theme={theme} multiline />

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Tags
            </ThemedText>
            <TagEditor tags={tags} onChange={setTags} />
          </View>

          <Pressable style={[styles.saveButton, { backgroundColor: theme.text }]} disabled={saving} onPress={handleSave}>
            <ThemedText themeColor="background" type="smallBold">
              {saving ? 'Saving…' : 'Save Changes'}
            </ThemedText>
          </Pressable>

          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <ThemedText type="smallBold" style={styles.deleteLabel}>
              Delete Item
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  theme,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  theme: ReturnType<typeof useTheme>;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { color: theme.text, borderColor: theme.backgroundElement },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  deleteButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  deleteLabel: {
    color: '#e0453c',
  },
});
