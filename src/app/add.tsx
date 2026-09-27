import Head from 'expo-router/head';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { SeriesSelector } from '@/components/series-selector';
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
import { useCloseScreen } from '@/hooks/use-close-screen';
import { useTheme } from '@/hooks/use-theme';
import { type CompressedPhoto, compressPhoto } from '@/lib/compress-photo';
import { useCatalog } from '@/lib/catalog-store';
import {
  createItem,
  findPossibleDuplicates,
  incrementQuantity,
  setItemStatus,
} from '@/lib/db';
import { createSeries, findSeriesByName } from '@/lib/series';
import { createTheme, findThemeByName } from '@/lib/themes';
import {
  AuthRequiredError,
  fetchUsage,
  GroqQuotaError,
  type ServerUsage,
  suggestTagsForPhoto,
} from '@/lib/groq';
import { auth } from '@/lib/firebase';

export default function AddItemScreen() {
  const close = useCloseScreen();
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
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('owned');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Offered as one-tap chips in the theme picker so an existing theme is never
  // retyped — that is what stops "拉拉熊" splitting into near-identical spellings.
  // Shared with every other screen; a write here marks it stale so the catalog
  // picks the change up on its next focus (lib/catalog-store.tsx).
  const { items: catalog, themes, series: seriesList, refresh, invalidate } = useCatalog();

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

  /** Series the AI named but that doesn't exist yet — offered, never auto-created. */
  const [suggestedSeries, setSuggestedSeries] = useState<string | null>(null);

  /** Theme the AI named but that isn't in the catalog yet — offered, never auto-created. */
  const [suggestedTheme, setSuggestedTheme] = useState<string | null>(null);

  /** Dismissed once the user says "not the same" — don't nag on every keystroke after. */
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);

  // Counted by the Worker, not the device. It used to be tracked locally, where
  // anyone could edit it — see worker/src/usage.ts.
  const [quota, setQuota] = useState<ServerUsage | null>(null);
  useEffect(() => {
    auth.currentUser
      ?.getIdToken()
      .then(fetchUsage)
      .then(setQuota)
      // A quota that won't load is not worth an error banner — the line simply
      // stays hidden, and analyzing still reports the real answer.
      .catch(() => setQuota(null));
  }, []);

  // Paused — see the import comment above for how to restore the ad-bonus flow.
  // Note it now needs a Worker endpoint to grant the bonus: the quota moved server
  // side, so granting one locally would no longer have any effect.
  // const handleRewardEarned = useCallback(async () => {
  //   await grantBonusOnServer(await auth.currentUser!.getIdToken());
  //   setQuota(await fetchUsage(await auth.currentUser!.getIdToken()));
  //   if (photo) await analyze(photo.full);
  // }, [photo]);
  // const bonusAd = useBonusAnalysisAd(handleRewardEarned);

  async function analyze(dataUri: string) {
    const user = auth.currentUser;
    if (!user) {
      setError('請重新登入後再試一次。');
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      // No local pre-check: the Worker holds the real count and refuses the call
      // itself, so checking here first would only add a number that can disagree.
      const { suggestion, usage } = await suggestTagsForPhoto(dataUri, await user.getIdToken());
      setQuota(usage);
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

      // Same rule as themes: a series is only picked when it already exists under
      // one of the matched themes, otherwise it is offered.
      const namedSeries = suggestion.series?.trim();
      const foundSeries = namedSeries ? findSeriesByName(seriesList, matched, namedSeries) : null;
      setSeriesId(foundSeries?.id ?? null);
      setSuggestedSeries(foundSeries || !namedSeries ? null : namedSeries);
      setType(suggestion.type ?? '');
      setSize(suggestion.size ?? '');
      setColor(suggestion.color ?? '');
      setTags(suggestion.tags);
      setAnalyzed(true);
    } catch (err) {
      // A quota message is already written for the reader; anything else is a
      // developer-facing string that needs the context of what failed.
      // Quota and sign-in messages are already written for the reader; anything
      // else is a developer-facing string that needs the context of what failed.
      if (err instanceof GroqQuotaError) {
        if (err.usage) setQuota(err.usage);
        setError(err.message);
      } else if (err instanceof AuthRequiredError) {
        setError(err.message);
      } else {
        setError(`AI 辨識失敗：${err instanceof Error ? err.message : String(err)}`);
      }
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
      invalidate();
      await createItem(
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
          thumbnail: photo?.thumbnail ?? null,
        },
        tags,
        photo?.full,
      );
      close();
    } catch (err) {
      setError(`儲存失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  // Recomputed from the three identifying fields, so correcting the type or picking
  // a different theme re-runs the check — the AI's first guess is often what a real
  // duplicate hinges on.
  const duplicates = useMemo(() => {
    if (duplicateDismissed) return [];
    return findPossibleDuplicates(catalog, {
      name,
      themeIds,
      seriesId,
      type: type || null,
    });
  }, [catalog, name, themeIds, seriesId, type, duplicateDismissed]);

  async function resolveDuplicate(action: () => Promise<void>, failure: string) {
    setSaving(true);
    setError(null);
    try {
      await action();
      close();
    } catch (err) {
      setError(`${failure}：${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  }

  const busy = preparingPhoto || analyzing;

  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>新增收藏 · SnapLocker</title>
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScreenContainer>
          <ScrollView contentContainerStyle={styles.scroll}>
            {error && <InlineBanner tone="error" message={error} onDismiss={() => setError(null)} />}

            <DuplicateCompare
              draft={{ name, thumbnail: photo?.thumbnail ?? null, size, color }}
              matches={duplicates}
              themeNamesFor={(item) =>
                item.themeIds
                  .map((id) => themes.find((th) => th.id === id)?.name)
                  .filter((label): label is string => Boolean(label))
              }
              seriesNameFor={(item) =>
                seriesList.find((s) => s.id === item.seriesId)?.name ?? null
              }
              onKeepAdding={() => setDuplicateDismissed(true)}
              onDiscard={() => close()}
              onIncrement={(id) => resolveDuplicate(() => incrementQuantity(id), '更新數量失敗')}
              onMarkOwned={(id) => resolveDuplicate(() => setItemStatus(id, 'owned'), '更新狀態失敗')}
            />

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
                    ? `今日還可 AI 辨識 ${quota.remaining} 次（每日免費 ${quota.limit} 次）`
                    : `今日 ${quota.limit} 次免費 AI 辨識已用完，明天重置`}
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

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  系列
                </ThemedText>
                {suggestedSeries && (
                  <InlineBanner
                    message={`AI 認為這是「${suggestedSeries}」系列，你的清單裡還沒有。`}
                    actionLabel="建立這個系列"
                    onAction={async () => {
                      if (themeIds.length === 0) return;
                      const id = await handleCreateSeries(themeIds[0], suggestedSeries);
                      setSeriesId(id);
                      setSuggestedSeries(null);
                    }}
                    onDismiss={() => setSuggestedSeries(null)}
                  />
                )}
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
