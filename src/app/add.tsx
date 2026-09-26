import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { Icon } from '@/components/icon';
import { DuplicateCompare } from '@/components/duplicate-compare';
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
// Paused for now — rewarded-ad bonus quota. Re-enable by uncommenting this import,
// the `handleRewardEarned`/`bonusAd` block below, and the ad-gate button in the JSX,
// plus reinstalling react-native-google-mobile-ads + expo-dev-client and restoring
// the plugin entry in app.json. See README's "Daily AI quota + rewarded ads" section.
// import { useBonusAnalysisAd } from '@/hooks/use-bonus-analysis-ad';
import { useTheme } from '@/hooks/use-theme';
import { type CompressedPhoto, compressPhoto } from '@/lib/compress-photo';
import {
  createItem,
  findPossibleDuplicates,
  incrementQuantity,
  type ItemWithTags,
  listItems,
} from '@/lib/db';
import { createTheme, findThemeByName, listThemes, type Theme } from '@/lib/themes';
import { suggestTagsForPhoto } from '@/lib/groq';
import { FREE_DAILY_LIMIT, getUsageToday, recordAnalysisUsed, UsageToday } from '@/lib/usage';

export default function AddItemScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Data URIs (not file:// URIs) so this works identically on native and web, and so
  // they can be stored directly on Firestore documents — see lib/compress-photo.ts
  // for why there are two sizes and lib/db.ts for where each one is written.
  const [photo, setPhoto] = useState<CompressedPhoto | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [saving, setSaving] = useState(false);
  // Alert.alert is a no-op on react-native-web, so problems are surfaced in the page.
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [series, setSeries] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('owned');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Offered as one-tap chips in the theme picker so an existing theme is never
  // retyped — that is what stops "拉拉熊" splitting into near-identical spellings.
  const [themes, setThemes] = useState<Theme[]>([]);
  const refreshThemes = useCallback(() => {
    listThemes()
      .then(setThemes)
      .catch(() => setThemes([]));
  }, []);
  useEffect(refreshThemes, [refreshThemes]);

  async function handleCreateTheme(name: string): Promise<string> {
    const id = await createTheme(name);
    refreshThemes();
    return id;
  }

  /** Theme the AI named but that isn't in the catalog yet — offered, never auto-created. */
  const [suggestedTheme, setSuggestedTheme] = useState<string | null>(null);

  // The whole catalog, kept for the duplicate check. It is only thumbnails and text
  // now that full photos live elsewhere (lib/db.ts), so holding it is cheap.
  const [catalog, setCatalog] = useState<ItemWithTags[]>([]);
  useEffect(() => {
    listItems()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);
  /** Dismissed once the user says "not the same" — don't nag on every keystroke after. */
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);

  const [quota, setQuota] = useState<UsageToday | null>(null);
  useEffect(() => {
    getUsageToday().then(setQuota);
  }, []);

  // Paused — see the import comment above for how to restore the ad-bonus flow.
  // const handleRewardEarned = useCallback(async () => {
  //   const updated = await grantBonusAnalysis();
  //   setQuota(updated);
  //   if (photo) await analyze(photo.full);
  // }, [photo]);
  // const bonusAd = useBonusAnalysisAd(handleRewardEarned);

  async function analyze(dataUri: string) {
    // Re-check against the database rather than the `quota` state closure, so this
    // stays correct even if called right after quota changed elsewhere.
    const current = await getUsageToday();
    if (current.remaining <= 0) {
      setQuota(current);
      setError(`今天的 ${FREE_DAILY_LIMIT} 次免費 AI 辨識已用完，明天會重置。你還是可以自己填寫欄位後儲存。`);
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      const suggestion = await suggestTagsForPhoto(dataUri);
      setName(suggestion.name);

      // Match the model's answer against existing themes and their aliases before
      // touching the list. It names an IP for anything character-shaped — confidently,
      // and sometimes wrongly — so an unmatched name is offered, never created.
      const matched: string[] = [];
      let unmatched: string | null = null;
      for (const themeName of suggestion.themes) {
        const found = await findThemeByName(themeName);
        if (found) matched.push(found.id);
        else if (!unmatched) unmatched = themeName;
      }
      setThemeIds(matched);
      setSuggestedTheme(unmatched);
      setSeries(suggestion.series ?? '');
      setType(suggestion.type ?? '');
      setSize(suggestion.size ?? '');
      setColor(suggestion.color ?? '');
      setTags(suggestion.tags);
      setAnalyzed(true);
      setQuota(await recordAnalysisUsed());
    } catch (err) {
      setError(`AI 辨識失敗：${err instanceof Error ? err.message : String(err)}`);
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
      setError(source === 'camera' ? '需要相機權限才能拍照。' : '需要相簿權限才能選擇照片。');
      return;
    }

    const options: ImagePicker.ImagePickerOptions = { quality: 0.9, allowsEditing: true };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);

    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setPreparingPhoto(true);
    setError(null);
    try {
      const compressed = await compressPhoto(asset.uri);
      setPhoto(compressed);
      // Recognize first, then let the fields be corrected — the whole point of the
      // screen is that you rarely have to type from scratch. The full rendition goes
      // to the model: the thumbnail is too small to read a character's face from.
      await analyze(compressed.full);
    } catch (err) {
      setError(`照片處理失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPreparingPhoto(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('請先填寫名稱再儲存。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createItem(
        {
          name: name.trim(),
          themeIds,
          series: series.trim() || null,
          type: type.trim() || null,
          status,
          size: size.trim() || null,
          quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
          color: color.trim() || null,
          notes: notes.trim() || null,
          thumbnail: photo?.thumbnail ?? null,
        },
        tags,
        photo?.full,
      );
      router.back();
    } catch (err) {
      setError(`儲存失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  // Recomputed from the three identifying fields, so correcting the type or picking
  // a different theme re-runs the check — the AI's first guess is often what a real
  // duplicate hinges on.
  const duplicate = useMemo(() => {
    if (duplicateDismissed) return null;
    const matches = findPossibleDuplicates(catalog, { themeIds, series: series || null, type: type || null });
    return matches[0] ?? null;
  }, [catalog, themeIds, series, type, duplicateDismissed]);

  async function handleIncrementExisting() {
    if (!duplicate) return;
    setSaving(true);
    setError(null);
    try {
      await incrementQuantity(duplicate.id);
      router.back();
    } catch (err) {
      setError(`更新數量失敗：${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  }

  const busy = preparingPhoto || analyzing;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScreenContainer>
          <ScrollView contentContainerStyle={styles.scroll}>
            {error && <InlineBanner tone="error" message={error} onDismiss={() => setError(null)} />}

            {duplicate && (
              <DuplicateCompare
                draft={{ name, thumbnail: photo?.thumbnail ?? null, size, color }}
                existing={duplicate}
                themeNames={themes.filter((th) => themeIds.includes(th.id)).map((th) => th.name)}
                onKeepAdding={() => setDuplicateDismissed(true)}
                onDiscard={() => router.back()}
                onIncrement={handleIncrementExisting}
              />
            )}

            <Section title="照片" hint="先拍照辨識，再確認收藏資訊">
              <View style={styles.photoRow}>
                <View style={[styles.photoWrap, { backgroundColor: theme.backgroundSelected }]}>
                  {photo ? (
                    <Image source={{ uri: photo.thumbnail }} style={styles.photo} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoEmpty}>
                      <Icon name="image" size={22} color={theme.textSecondary} />
                    </View>
                  )}
                </View>

                <View style={styles.photoButtons}>
                  <ActionButton icon="camera" label="拍照" disabled={busy} onPress={() => pickFrom('camera')} />
                  <ActionButton icon="upload" label="從相簿選擇" disabled={busy} onPress={() => pickFrom('library')} />
                  {photo && quota && quota.remaining > 0 && (
                    <ActionButton
                      icon="sparkles"
                      label={analyzing ? '辨識中…' : '重新辨識這張照片'}
                      disabled={busy}
                      onPress={() => analyze(photo.full)}
                    />
                  )}
                </View>
              </View>

              {busy ? (
                <View style={styles.statusRow}>
                  <ActivityIndicator color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {preparingPhoto && !analyzing ? '照片處理中…' : 'AI 正在辨識照片…'}
                  </ThemedText>
                </View>
              ) : analyzed ? (
                <View style={styles.statusRow}>
                  <Icon name="check" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    AI 辨識完成，下方欄位可以直接修改
                  </ThemedText>
                </View>
              ) : null}

              {quota && (
                <ThemedText type="small" themeColor="textSecondary">
                  {quota.remaining > 0
                    ? `今日還可 AI 辨識 ${quota.remaining} 次（每日免費 ${FREE_DAILY_LIMIT} 次）`
                    : `今日 ${FREE_DAILY_LIMIT} 次免費 AI 辨識已用完，明天重置`}
                </ThemedText>
              )}

              {/* Paused — rewarded-ad bonus button. See the import comment near the top of this file. */}
              {/* {quota && quota.remaining === 0 && (
                <ActionButton
                  icon="sparkles"
                  label={bonusAd.isReady ? '看廣告，多辨識 1 次' : '廣告準備中…'}
                  disabled={!bonusAd.isReady}
                  onPress={bonusAd.show}
                />
              )} */}
            </Section>

            <Section title="基本資料">
              <FormField label="名稱" value={name} onChangeText={setName} placeholder="例：拉拉熊 草莓系列 坐姿玩偶" />

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  主題
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  聯名商品可以選兩個，之後從任一邊都找得到
                </ThemedText>
                {suggestedTheme && (
                  <InlineBanner
                    message={`AI 認為這是「${suggestedTheme}」，你的主題清單裡還沒有。`}
                    actionLabel="建立這個主題"
                    onAction={async () => {
                      const id = await handleCreateTheme(suggestedTheme);
                      setThemeIds((ids) => [...ids, id]);
                      setSuggestedTheme(null);
                    }}
                    onDismiss={() => setSuggestedTheme(null)}
                  />
                )}
                <ThemeSelector
                  value={themeIds}
                  themes={themes}
                  onChange={setThemeIds}
                  onCreate={handleCreateTheme}
                />
              </View>

              <FormField label="系列" value={series} onChangeText={setSeries} placeholder="例：草莓派對系列" />
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
                  <FormField label="尺寸" value={size} onChangeText={setSize} placeholder="例：M・坐姿" />
                </View>
                <View style={styles.pairItem}>
                  <FormField label="數量" value={quantity} onChangeText={setQuantity} placeholder="1" />
                </View>
              </View>

              <FormField label="顏色" value={color} onChangeText={setColor} placeholder="例：棕色、粉紅色" />

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  標籤
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  中英文都會存，之後兩種打法都搜得到
                </ThemedText>
                <TagEditor tags={tags} onChange={setTags} />
              </View>
            </Section>

            <Section title="收藏狀態">
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  還沒買的先存成「想要」，逛街時查得到
                </ThemedText>
                <StatusToggle value={status} onChange={setStatus} />
              </View>
              <FormField
                label="備註"
                value={notes}
                onChangeText={setNotes}
                placeholder="購入日期、價格、在哪買的…"
                multiline
              />
            </Section>

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.accent }, saving && styles.disabled]}
              disabled={saving}
              onPress={handleSave}>
              <ThemedText themeColor="onAccent" type="smallBold">
                {saving ? '儲存中…' : '儲存收藏'}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </ScreenContainer>
      </SafeAreaView>
    </ThemedView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'camera' | 'upload' | 'sparkles';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      style={[styles.button, { backgroundColor: theme.backgroundElement }, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}>
      <Icon name={icon} size={16} color={theme.text} />
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  photoRow: { flexDirection: 'row', gap: Spacing.three },
  photoWrap: {
    width: 112,
    height: 112,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoButtons: { flex: 1, gap: Spacing.two, justifyContent: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  disabled: { opacity: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  field: { gap: Spacing.one },
  hint: { opacity: 0.7, marginTop: -2 },
  pairRow: { flexDirection: 'row', gap: Spacing.three },
  pairItem: { flex: 1 },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
