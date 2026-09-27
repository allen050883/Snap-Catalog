import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';
import { useTheme } from '@/hooks/use-theme';

export function LoginScreen() {
  const theme = useTheme();
  const { signIn, isReady, signingIn, error } = useGoogleSignIn();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          SnapLocker
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          藏寶盒 · 收納此刻，捕捉心動
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          用 Google 帳號登入，你的收藏會跟著帳號走，換手機也不會不見。
        </ThemedText>

        <Pressable
          style={[styles.button, { backgroundColor: theme.accent }, !isReady && styles.buttonDisabled]}
          disabled={!isReady || signingIn}
          onPress={signIn}>
          {signingIn ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <ThemedText themeColor="onAccent" type="smallBold">
              使用 Google 登入
            </ThemedText>
          )}
        </Pressable>

        {error && (
          <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
            登入失敗：{error}
          </ThemedText>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.two,
    alignItems: 'center',
    minWidth: 240,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    textAlign: 'center',
  },
});
