import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TagEditor } from '@/components/tag-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createItem } from '@/lib/db';
import { suggestTagsForPhoto } from '@/lib/groq';

const PHOTOS_DIR = `${FileSystem.documentDirectory}photos/`;

async function persistPhoto(sourceUri: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true }).catch(() => {});
  const destUri = `${PHOTOS_DIR}${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

export default function AddItemScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [character, setCharacter] = useState('');
  const [series, setSeries] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  async function analyze(uri: string) {
    setAnalyzing(true);
    try {
      const suggestion = await suggestTagsForPhoto(uri);
      setName(suggestion.name);
      setCharacter(suggestion.character ?? '');
      setSeries(suggestion.series ?? '');
      setCategory(suggestion.category ?? '');
      setColor(suggestion.color ?? '');
      setTags(suggestion.tags);
    } catch (error) {
      Alert.alert('AI tagging failed', error instanceof Error ? error.message : String(error));
    } finally {
      setAnalyzing(false);
    }
  }

  async function pickFrom(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to continue.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });

    if (result.canceled || !result.assets[0]) return;

    const savedUri = await persistPhoto(result.assets[0].uri);
    setPhotoUri(savedUri);
    await analyze(savedUri);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give this item a name before saving.');
      return;
    }
    setSaving(true);
    try {
      await createItem(
        {
          name: name.trim(),
          character: character.trim() || null,
          series: series.trim() || null,
          category: category.trim() || null,
          color: color.trim() || null,
          notes: notes.trim() || null,
          photoUri,
        },
        tags,
      );
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.photoRow}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText themeColor="textSecondary">No photo</ThemedText>
              </View>
            )}
            <View style={styles.photoButtons}>
              <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} onPress={() => pickFrom('camera')}>
                <ThemedText>Take Photo</ThemedText>
              </Pressable>
              <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} onPress={() => pickFrom('library')}>
                <ThemedText>Choose from Library</ThemedText>
              </Pressable>
              {photoUri && (
                <Pressable
                  style={[styles.button, { backgroundColor: theme.backgroundElement }]}
                  disabled={analyzing}
                  onPress={() => analyze(photoUri)}>
                  <ThemedText>{analyzing ? 'Re-analyzing…' : 'Re-run AI tagging'}</ThemedText>
                </Pressable>
              )}
            </View>
          </View>

          {analyzing && (
            <View style={styles.analyzingRow}>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                Asking AI to identify this item…
              </ThemedText>
            </View>
          )}

          <Field label="Name" value={name} onChangeText={setName} theme={theme} />
          <Field label="Character" value={character} onChangeText={setCharacter} theme={theme} />
          <Field label="Series" value={series} onChangeText={setSeries} theme={theme} />
          <Field label="Category" value={category} onChangeText={setCategory} theme={theme} placeholder="plush, figure, keychain…" />
          <Field label="Color" value={color} onChangeText={setColor} theme={theme} />
          <Field label="Notes" value={notes} onChangeText={setNotes} theme={theme} multiline />

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Tags
            </ThemedText>
            <TagEditor tags={tags} onChange={setTags} />
          </View>

          <Pressable
            style={[styles.saveButton, { backgroundColor: theme.text }]}
            disabled={saving}
            onPress={handleSave}>
            <ThemedText themeColor="background" type="smallBold">
              {saving ? 'Saving…' : 'Save Item'}
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
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  theme: ReturnType<typeof useTheme>;
  placeholder?: string;
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
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
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
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: Spacing.two,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtons: {
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.one,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
});
