import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ActivityIndicator } from 'react-native';
// Paused for now — rewarded-ad bonus quota. Re-enable alongside src/app/add.tsx's
// commented-out ad-bonus block; see README's "Daily AI quota + rewarded ads" section.
// import { useEffect } from 'react';
// import { Platform } from 'react-native';
// import mobileAds from 'react-native-google-mobile-ads';

import { LoginScreen } from '@/components/login-screen';
import { Colors } from '@/constants/theme';
import { ThemedView } from '@/components/themed-view';
import { useAuthUser } from '@/hooks/use-auth-user';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.backgroundSelected,
    primary: Colors.accent,
  },
};

export default function RootLayout() {
  const { user, initializing } = useAuthUser();

  // useEffect(() => {
  //   // No ads SDK on web. Also: this only initializes the SDK for Google's test ads
  //   // (see app.json's test App IDs) — swap in your real AdMob IDs before release,
  //   // and add a consent flow if you'll have users in the EU (see the package's docs).
  //   if (Platform.OS !== 'web') {
  //     mobileAds().initialize();
  //   }
  // }, []);

  return (
    <ThemeProvider value={navigationTheme}>
      {initializing ? (
        <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </ThemedView>
      ) : !user ? (
        <LoginScreen />
      ) : (
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Snap Catalog', headerShown: false }} />
          <Stack.Screen name="add" options={{ title: '新增收藏', presentation: 'modal' }} />
          <Stack.Screen name="item/[id]" options={{ title: '收藏細節' }} />
        </Stack>
      )}
    </ThemeProvider>
  );
}
