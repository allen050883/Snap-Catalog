import Head from 'expo-router/head';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { SeriesSelector } from '@/components/series-selector';
import { Icon } from '@/components/icon';
import { InlineBanner } from '@/components/inline-banner';
import { ScreenContainer } from '@/components/screen-container';
import { Section } from '@/components/section';
import { StatusToggle } from '@/components/status-toggle';
import { TagEditor } from '@/components/tag-editor';
import { ThemeSelector } from '@/components/theme-selector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TypePicker } from '@/components/type-picker';
import { Spacing } from '@/constants/theme';
import { useCloseScreen } from '@/hooks/use-close-screen';
import { useTheme } from '@/hooks/use-theme';
import { useCatalog } from '@/lib/catalog-store';
import { deleteItem, getItem, getItemPhoto, ItemWithTags, updateItem } from '@/lib/db';
import { createSeries } from '@/lib/series';
import { createTheme } from '@/lib/themes';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const close = useCloseScreen();
  const theme = useTheme();

  const [item, setItem] = useState<ItemWithTags | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('owned');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Alert.alert is a no-op on react-native-web — both the error messages and the
  // delete confirmation have to render in the page to exist at all in a browser.
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The item document carries only a thumbnail (see lib/db.ts); the full photo is a
  // second read, so the screen paints the small one first and swaps when it lands
  // rather than holding the whole page back on an image.
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);

  // Shared with every other screen (lib/catalog-store.tsx).
  const { themes, series: seriesList, refresh, invalidate } = useCatalog();

  async function handleCreateTheme(name: string): Promise<string> {
    const id = await createTheme(name);
    invalidate();
    await refresh();
    return id;
  }

  async function handleCreateSeries(themeId: string, name: string): Promise<string> {
    const id = await createSeries(themeId, name);
    invalidate();
    await refresh();
    return id;
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getItemPhoto(id)
      .then((photo) => {
        if (!cancelled) setFullPhoto(photo);
      })
      // A missing or unreadable full photo is not worth an error banner — the
      // thumbnail is already on screen and every field still works.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    getItem(id)
      .then((loaded) => {
        if (!loaded) return;
        setItem(loaded);
        setName(loaded.name);
        setThemeIds(loaded.themeIds);
        setSeriesId(loaded.seriesId);
        setType(loaded.type ?? '');
        setStatus(loaded.status);
        setSize(loaded.size ?? '');
        setQuantity(String(loaded.quantity));
        setColor(loaded.color ?? '');
        setNotes(loaded.notes ?? '');
        setTags(loaded.tags);
      })
      .catch((err) => setError(`載入失敗：${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!item) return;
    if (!name.trim()) {
      setError('請先填寫名稱再儲存。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      invalidate();
      await updateItem(
        item.id,
        {
          name: name.trim(),
          themeIds,
          seriesId,
          type: type.trim() || null,
          status,
          size: size.trim() || null,
          quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
          color: color.trim() || null,
          notes: notes.trim() || null,
          thumbnail: item.thumbnail,
        },
        tags,
      );
      close();
    } catch (err) {
      setError(`儲存失敗：${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    try {
      invalidate();
      await deleteItem(item.id);
      close();
    } catch (err) {
      setConfirmingDelete(false);
      setError(`刪除失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (loading || !item) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenContainer style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary">
              {loading ? '載入中…' : '找不到這筆收藏。'}
            </ThemedText>
          </ScreenContainer>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const createdAt = new Date(item.createdAt);
  const createdLabel = `${createdAt.getFullYear()}/${String(createdAt.getMonth() + 1).padStart(2, '0')}/${String(
    createdAt.getDate(),
  ).padStart(2, '0')}`;

  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>收藏細節 · SnapLocker</title>
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScreenContainer>
          <ScrollView contentContainerStyle={styles.scroll}>
            {error && <InlineBanner tone="error" message={error} onDismiss={() => setError(null)} />}

            {(fullPhoto ?? item.thumbnail) && (
              <Image
                source={{ uri: fullPhoto ?? item.thumbnail! }}
                style={[styles.photo, { backgroundColor: theme.backgroundElement }]}
                resizeMode="cover"
              />
            )}

            <ThemedText type="small" themeColor="textSecondary">
              建立於 {createdLabel}
            </ThemedText>

            <Section title="基本資料">
              <FormField label="名稱" value={name} onChangeText={setName} />

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  主題
                </ThemedText>
                <ThemeSelector
                  value={themeIds}
                  themes={themes}
                  onChange={setThemeIds}
                  onCreate={handleCreateTheme}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  系列
                </ThemedText>
                <SeriesSelector
                  value={seriesId}
                  series={seriesList}
                  themeIds={themeIds}
                  onChange={setSeriesId}
                  onCreate={handleCreateSeries}
                />
              </View>
            </Section>

            <Section title="分類與標籤">
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  類型
                </ThemedText>
                <TypePicker value={type} onChange={setType} />
              </View>

              <View style={styles.pairRow}>
                <View style={styles.pairItem}>
                  <FormField label="尺寸" value={size} onChangeText={setSize} />
                </View>
                <View style={styles.pairItem}>
                  <FormField label="數量" value={quantity} onChangeText={setQuantity} />
                </View>
              </View>

              <FormField label="顏色" value={color} onChangeText={setColor} />

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  標籤
                </ThemedText>
                <TagEditor tags={tags} onChange={setTags} />
              </View>
            </Section>

            <Section title="收藏狀態">
              <View style={styles.field}>
                <StatusToggle value={status} onChange={setStatus} />
              </View>
              <FormField label="備註" value={notes} onChangeText={setNotes} multiline />
            </Section>

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.accent }, saving && styles.disabled]}
              disabled={saving}
              onPress={handleSave}>
              <ThemedText themeColor="onAccent" type="smallBold">
                {saving ? '儲存中…' : '儲存變更'}
              </ThemedText>
            </Pressable>

            {confirmingDelete ? (
              <InlineBanner
                tone="danger"
                message={`確定要刪除「${item.name}」？此動作無法復原。`}
                actionLabel="確定刪除"
                onAction={handleDelete}
                onDismiss={() => setConfirmingDelete(false)}
              />
            ) : (
              <Pressable style={styles.deleteButton} onPress={() => setConfirmingDelete(true)}>
                <Icon name="trash" size={16} color={theme.danger} />
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  刪除這筆收藏
                </ThemedText>
              </Pressable>
            )}
          </ScrollView>
        </ScreenContainer>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  photo: { width: '100%', height: 260, borderRadius: Spacing.three },
  field: { gap: Spacing.one },
  pairRow: { flexDirection: 'row', gap: Spacing.three },
  pairItem: { flex: 1 },
  disabled: { opacity: 0.5 },
  saveButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
