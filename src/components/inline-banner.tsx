import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// react-native-web's Alert.alert() is an empty function, so anything this app used
// Alert for was silently invisible in the browser — errors included, and the delete
// confirmation too, which made deleting impossible on web. Rendering the message in
// the page works on every platform.
export function InlineBanner({
  tone = 'info',
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  tone?: 'info' | 'error' | 'danger';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const theme = useTheme();
  const accent = tone === 'info' ? theme.textSecondary : theme.danger;

  return (
    <View style={[styles.banner, { backgroundColor: theme.backgroundElement, borderColor: accent }]}>
      <ThemedText type="small" style={[styles.message, tone !== 'info' && { color: accent }]}>
        {message}
      </ThemedText>
      <View style={styles.actions}>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              取消
            </ThemedText>
          </Pressable>
        )}
        {actionLabel && onAction && (
          <Pressable onPress={onAction} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: accent }}>
              {actionLabel}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    borderLeftWidth: 3,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  message: { flex: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
