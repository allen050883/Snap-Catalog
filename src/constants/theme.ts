/**
 * The app's colors, spacing and type scale. There are many other ways to style a
 * React Native app — [Nativewind](https://www.nativewind.dev/),
 * [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app).
 */

import '@/global.css';

import { Platform } from 'react-native';

// A single warm, fixed palette — the app deliberately does not follow the OS dark
// mode. A catalog of collectibles is mostly photographs, and a cream ground flatters
// them the way a gallery wall does, where pure black (the previous dark theme) both
// fought the photos and made the plain layout look unfinished.
//
// Contrast ratios against `background`, all at or above WCAG AA's 4.5:1 for text:
//   text          13.8:1
//   textSecondary  4.7:1
//   danger         5.3:1
//   text on accent 5.5:1  (accent is a fill, never text — pair it with onAccent)
export const Colors = {
  background: '#FDFBF7',
  /** Cards, inputs, section bodies — one step up from the page. */
  backgroundElement: '#F5F0E8',
  /** Pressed/secondary buttons and photo placeholders — two steps up. */
  backgroundSelected: '#E9E1D3',
  /** Item cards lift off the cream ground by going lighter, not darker. */
  card: '#FFFFFF',
  text: '#2E2A24',
  textSecondary: '#7A7064',
  /** Fills only: the FAB, primary buttons, selected chips. */
  accent: '#D98E7A',
  /** Text and icons sitting on top of `accent`. */
  onAccent: '#2E2A24',
  danger: '#B3453A',
} as const;

export type ThemeColor = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
