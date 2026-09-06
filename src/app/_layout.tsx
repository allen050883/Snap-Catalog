import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
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
