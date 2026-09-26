import Feather from '@expo/vector-icons/Feather';

import { Colors } from '@/constants/theme';

// A small named set rather than exposing Feather directly: the design uses a fixed
// vocabulary of icons, and naming them by role keeps the screens from picking
// near-duplicates ("trash" vs "trash-2") that then look inconsistent side by side.
const GLYPHS = {
  archive: 'archive',
  camera: 'camera',
  check: 'check',
  chevron: 'chevron-right',
  close: 'x',
  image: 'image',
  logout: 'log-out',
  plus: 'plus',
  search: 'search',
  settings: 'settings',
  sparkles: 'zap',
  trash: 'trash-2',
  upload: 'upload',
} as const;

export type IconName = keyof typeof GLYPHS;

export function Icon({
  name,
  size = 20,
  color = Colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={GLYPHS[name]} size={size} color={color} />;
}
