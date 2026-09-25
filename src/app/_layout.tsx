import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
// Paused for now — rewarded-ad bonus quota. Re-enable alongside src/app/add.tsx's
// commented-out ad-bonus block; see README's "Daily AI quota + rewarded ads" section.
// import { useEffect } from 'react';
// import { Platform } from 'react-native';
// import mobileAds from 'react-native-google-mobile-ads';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // useEffect(() => {
  //   // No ads SDK on web. Also: this only initializes the SDK for Google's test ads
  //   // (see app.json's test App IDs) — swap in your real AdMob IDs before release,
  //   // and add a consent flow if you'll have users in the EU (see the package's docs).
  //   if (Platform.OS !== 'web') {
  //     mobileAds().initialize();
  //   }
  // }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Snap Catalog' }} />
        <Stack.Screen name="add" options={{ title: 'Add Item', presentation: 'modal' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
      </Stack>
    </ThemeProvider>
  );
}
