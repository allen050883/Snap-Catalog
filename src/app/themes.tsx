import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { InlineBanner } from '@/components/inline-banner';
import { ScreenContainer } from '@/components/screen-container';
import { Section } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listItems } from '@/lib/db';
import { deleteSeries, listSeries, type Series } from '@/lib/series';
import { createTheme, deleteTheme, listThemes, type Theme, updateTheme } from '@/lib/themes';

export default function ThemesScreen() {
  const palette = useTheme();

  const [themes, setThemes] = useState<Theme[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const reload = useCallback(() => {
    Promise.all([listThemes(), listItems(), listSeries()])
      .then(([loadedThemes, items, loadedSeries]) => {
        setThemes(loadedThemes);
        setSeries(loadedSeries);
        const tally: Record<string, number> = {};
        for (const item of items) {
          for (const id of item.themeIds) tally[id] = (tally[id] ?? 0) + 1;
        }
        setCounts(tally);
      })
      .catch((err) => setError(`載入失敗：${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);

  async function run(action: () => Promise<unknown>, failure: string) {
    setError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setError(`${failure}：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScreenContainer>
          <ScrollView contentContainerStyle={styles.scroll}>
            {error && <InlineBanner tone="error" message={error} onDismiss={() => setError(null)} />}

            <Section title="新增主題" hint="收藏的第一層分類">
              <View style={styles.addRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={() => {
                    const name = draft.trim();
                    if (!name) return;
                    setDraft('');
                    run(() => createTheme(name), '建立失敗');
                  }}
                  placeholder="例：拉拉熊"
                  placeholderTextColor={palette.textSecondary}
                  style={[styles.input, { color: palette.text, backgroundColor: palette.backgroundElement }]}
                />
              </View>
            </Section>

            {loading ? (
              <ThemedText type="small" themeColor="textSecondary">
                載入中…
              </ThemedText>
            ) : themes.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                還沒有任何主題。新增收藏時 AI 辨識出角色，也可以從那裡建立。
              </ThemedText>
            ) : (
              themes.map((theme) => (
                <ThemeRow
                  key={theme.id}
                  theme={theme}
                  count={counts[theme.id] ?? 0}
                  series={series.filter((s) => s.themeId === theme.id)}
                  editing={editing === theme.id}
                  confirmingDelete={confirmingDelete === theme.id}
                  onToggleEdit={() => setEditing(editing === theme.id ? null : theme.id)}
                  onSave={(name, aliases) =>
                    run(async () => {
                      await updateTheme(theme.id, name, aliases);
                      setEditing(null);
                    }, '儲存失敗')
                  }
                  onAskDelete={() => setConfirmingDelete(theme.id)}
                  onCancelDelete={() => setConfirmingDelete(null)}
                  onDelete={() =>
                    run(async () => {
                      // A series only means something inside its theme, so it goes
                      // with it rather than becoming unreachable.
                      await Promise.all(
                        series.filter((s) => s.themeId === theme.id).map((s) => deleteSeries(s.id)),
                      );
                      await deleteTheme(theme.id);
                      setConfirmingDelete(null);
                    }, '刪除失敗')
                  }
                />
              ))
            )}
          </ScrollView>
        </ScreenContainer>
      </SafeAreaView>
    </ThemedView>
  );
}

function ThemeRow({
  theme,
  count,
  series,
  editing,
  confirmingDelete,
  onToggleEdit,
  onSave,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  theme: Theme;
  count: number;
  series: Series[];
  editing: boolean;
  confirmingDelete: boolean;
  onToggleEdit: () => void;
  onSave: (name: string, aliases: string[]) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const palette = useTheme();
  const [name, setName] = useState(theme.name);
  const [aliasText, setAliasText] = useState(theme.aliases.join('、'));

  return (
    <View style={[styles.row, { backgroundColor: palette.card }]}>
      <View style={styles.rowHead}>
        <View style={styles.rowTitle}>
          <ThemedText type="smallBold">{theme.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {count} 件收藏
            {series.length > 0 ? ` · ${series.length} 個系列` : ''}
            {theme.aliases.length > 0 ? ` · 別名 ${theme.aliases.join('、')}` : ''}
          </ThemedText>
          {series.length > 0 && (
            <View style={styles.seriesRow}>
              {series.map((s) => (
                <View key={s.id} style={[styles.seriesChip, { backgroundColor: palette.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.name}
                    {s.year ? ` ${s.year}` : ''}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>
        <Pressable onPress={onToggleEdit} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            {editing ? '收起' : '編輯'}
          </ThemedText>
        </Pressable>
      </View>

      {editing && (
        <View style={styles.editor}>
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              名稱
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.input, { color: palette.text, backgroundColor: palette.backgroundElement }]}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              別名
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              AI 辨識出的名稱會比對這些，用頓號或逗號分隔。例：Rilakkuma、リラックマ
            </ThemedText>
            <TextInput
              value={aliasText}
              onChangeText={setAliasText}
              placeholder="Rilakkuma、リラックマ"
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, { color: palette.text, backgroundColor: palette.backgroundElement }]}
            />
          </View>

          <Pressable
            onPress={() => onSave(name, aliasText.split(/[、,，]/))}
            style={[styles.saveButton, { backgroundColor: palette.accent }]}>
            <ThemedText type="smallBold" themeColor="onAccent">
              儲存
            </ThemedText>
          </Pressable>

          {confirmingDelete ? (
            <InlineBanner
              tone="danger"
              message={
                count > 0 || series.length > 0
                  ? `刪除「${theme.name}」？底下 ${series.length} 個系列會一併刪除，${count} 件收藏會失去這個主題但不會被刪除。`
                  : `確定要刪除「${theme.name}」？`
              }
              actionLabel="確定刪除"
              onAction={onDelete}
              onDismiss={onCancelDelete}
            />
          ) : (
            <Pressable onPress={onAskDelete} style={styles.deleteButton}>
              <Icon name="trash" size={16} color={palette.danger} />
              <ThemedText type="smallBold" style={{ color: palette.danger }}>
                刪除這個主題
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  addRow: { gap: Spacing.two },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  rowTitle: { flex: 1, gap: 2 },
  seriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginTop: Spacing.one },
  seriesChip: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  editor: { gap: Spacing.three },
  field: { gap: Spacing.one },
  hint: { opacity: 0.7, marginTop: -2 },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  saveButton: { paddingVertical: Spacing.two + 2, borderRadius: Spacing.two, alignItems: 'center' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
