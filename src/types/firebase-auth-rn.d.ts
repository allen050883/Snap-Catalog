// Type-only shim. `getReactNativePersistence` exists at runtime — Metro correctly
// resolves the React Native build of @firebase/auth via its "react-native" package
// export condition — but TypeScript's own conditional-exports resolution for
// `firebase/auth`'s *types* field picks a generic declaration file that omits this
// RN-only export (a gap in firebase's package.json, not a real missing feature).
// This augmentation just restores the type so tsc stops complaining; it has zero
// effect on the actual bundled code.
import type { AsyncStorage } from '@react-native-async-storage/async-storage';
import type { Persistence } from 'firebase/auth';

// The `export {}` (plus the imports above) make this file an actual ES module, so
// the `declare module` below is a MERGE/augmentation of the real 'firebase/auth'
// module rather than a full replacement of it — without this, every other export
// from 'firebase/auth' would disappear from TypeScript's view in this project.
export {};

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: AsyncStorage): Persistence;
}
