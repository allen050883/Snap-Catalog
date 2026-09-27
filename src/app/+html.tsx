import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors } from '@/constants/theme';

/**
 * The HTML shell every web page is rendered into. It runs only in Node during
 * static rendering, never in the browser, so it has no access to app state.
 *
 * It exists here for the document title: with `headerShown: false` on the home
 * screen, the Stack's `title` never reaches `document.title`, and the browser tab
 * was rendering blank.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-Hant">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>SnapLocker 藏寶盒</title>
        <meta name="description" content="收納此刻，捕捉心動。拍照建檔你的收藏，買之前先查有沒有重複。" />
        {/* The app paints its own ground; without this the page flashes white first. */}
        <meta name="theme-color" content={Colors.background} />

        {/* Expo's reset for web: without it the body scrolls independently of the
            app's own scroll views, giving every screen two scrollbars. */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `body { background-color: ${Colors.background}; }` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
