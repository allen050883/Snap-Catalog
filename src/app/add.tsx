import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TagEditor } from '@/components/tag-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBonusAnalysisAd } from '@/hooks/use-bonus-analysis-ad';
import { useTheme } from '@/hooks/use-theme';
import { createItem } from '@/lib/db';
import { suggestTagsForPhoto } from '@/lib/groq';
import { FREE_DAILY_LIMIT, getUsageToday, grantBonusAnalysis, recordAnalysisUsed, UsageToday } from '@/lib/usage';

export default function AddItemScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Kept as base64 (not a file:// URI) so this works identically on native and web:
  // expo-image-picker's base64 option is cross-platform, whereas the file URIs it
  // returns are not (and expo-file-system has no document directory on web).
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const photoUri = photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : null;
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [character, setCharacter] = useState('');
  const [series, setSeries] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const [quota, setQuota] = useState<UsageToday | null>(null);
  useEffect(() => {
    getUsageToday().then(setQuota);
  }, []);

  const handleRewardEarned = useCallback(async () => {
    const updated = await grantBonusAnalysis();
    setQuota(updated);
    if (photoBase64) await analyze(photoBase64);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoBase64]);
  const bonusAd = useBonusAnalysisAd(handleRewardEarned);

  async function analyze(base64: string) {
    // Re-check against the database rather than the `quota` state closure, so this
    // stays correct even when called right after a bonus was just granted.
    const current = await getUsageToday();
    if (current.remaining <= 0) {
      setQuota(current);
      Alert.alert('今日次數已用完', '看一則廣告可以再多辨識 1 次。');
      return;
    }

    setAnalyzing(true);
    try {
      const suggestion = await suggestTagsForPhoto(base64);
      setName(suggestion.name);
      setCharacter(suggestion.character ?? '');
      setSeries(suggestion.series ?? '');
      setCategory(suggestion.category ?? '');
      setColor(suggestion.color ?? '');
      setTags(suggestion.tags);
      setQuota(await recordAnalysisUsed());
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

    const options: ImagePicker.ImagePickerOptions = { quality: 0.7, allowsEditing: true, base64: true };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);

    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;

    setPhotoBase64(asset.base64);
    await analyze(asset.base64);
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
              {photoBase64 && quota && quota.remaining > 0 && (
                <Pressable
                  style={[styles.button, { backgroundColor: theme.backgroundElement }]}
                  disabled={analyzing}
                  onPress={() => analyze(photoBase64)}>
                  <ThemedText>{analyzing ? 'Re-analyzing…' : 'Re-run AI tagging'}</ThemedText>
                </Pressable>
              )}
            </View>
          </View>

          {quota && (
            <ThemedText type="small" themeColor="textSecondary">
              {quota.remaining > 0
                ? `今日還可 AI 辨識 ${quota.remaining} 次（每日免費 ${FREE_DAILY_LIMIT} 次）`
                : `今日 ${FREE_DAILY_LIMIT} 次免費 AI 辨識已用完`}
            </ThemedText>
          )}

          {quota && quota.remaining === 0 && (
            <Pressable
              style={[styles.button, { backgroundColor: theme.backgroundElement }, !bonusAd.isReady && styles.buttonDisabled]}
              disabled={!bonusAd.isReady}
              onPress={bonusAd.show}>
              <ThemedText>{bonusAd.isReady ? '看廣告，多辨識 1 次' : '廣告準備中…'}</ThemedText>
            </Pressable>
          )}

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
  buttonDisabled: {
    opacity: 0.5,
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
