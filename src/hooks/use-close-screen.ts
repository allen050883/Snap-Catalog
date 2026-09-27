import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Leaves a screen that was opened on top of the catalog.
 *
 * `router.back()` alone throws "The action 'GO_BACK' was not handled by any
 * navigator" whenever there is nothing behind the current screen — opening
 * /add or /item/… from a pasted URL, or reloading the page while on one, which
 * on web happens constantly during development. Saving then succeeded but the
 * screen stayed put, which reads as the save having failed.
 */
export function useCloseScreen(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    // replace, not push: the screen being left should not become somewhere the
    // back button returns to.
    else router.replace('/');
  }, [router]);
}
