import { Colors } from '@/constants/theme';

// The palette is fixed rather than light/dark pair — see constants/theme.ts for why.
// Kept as a hook so switching back to a per-scheme palette later touches only this file.
export function useTheme() {
  return Colors;
}
