// Paused for now — rewarded-ad bonus quota. This hook's package
// (react-native-google-mobile-ads) is uninstalled, so its body is commented out
// to keep typecheck clean. To restore: `npm install
// react-native-google-mobile-ads@^17.2.0`, uncomment below, and see README's
// "Daily AI quota" section for the rest of the restore steps.

// import { useCallback, useEffect, useRef } from 'react';
// import { Platform } from 'react-native';
// import { TestIds, useRewardedAd } from 'react-native-google-mobile-ads';
//
// // Google's official sample ad unit ID — always serves a placeholder test ad and
// // never earns real revenue. Swap for your own AdMob rewarded ad unit before
// // shipping to real users (see README).
// const BONUS_AD_UNIT_ID = TestIds.REWARDED;
//
// export function useBonusAnalysisAd(onRewardEarned: () => void) {
//   // No ads SDK on web; the caller falls back to "no bonus available" there.
//   const enabled = Platform.OS !== 'web';
//   const { status, show, earnedReward, load } = useRewardedAd({
//     adUnitId: enabled ? BONUS_AD_UNIT_ID : null,
//   });
//   const handledReward = useRef(false);
//
//   useEffect(() => {
//     if (earnedReward && !handledReward.current) {
//       handledReward.current = true;
//       onRewardEarned();
//     }
//   }, [earnedReward, onRewardEarned]);
//
//   useEffect(() => {
//     if (status === 'closed' || status === 'no-fill' || status === 'error') {
//       handledReward.current = false;
//       load();
//     }
//   }, [status, load]);
//
//   return {
//     isReady: enabled && status === 'loaded',
//     isLoading: enabled && (status === 'idle' || status === 'loading'),
//     show: useCallback(() => show(), [show]),
//   };
// }
