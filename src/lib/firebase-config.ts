/**
 * Which Firebase project the app talks to.
 *
 * The values are meant to be public — access is enforced by the Firestore rules,
 * not by hiding these (see README). They are checked in as the default so a fresh
 * clone runs without any setup, and every one can be overridden per environment,
 * which is what lets a test build point at a separate project and keep its data
 * away from the real catalog.
 */
const DEFAULT = {
  apiKey: 'AIzaSyAJLyeBfSrR8MKAjYwdBtCITJcmts1OI1w',
  authDomain: 'snap-catalog-a0c41.firebaseapp.com',
  projectId: 'snap-catalog-a0c41',
  storageBucket: 'snap-catalog-a0c41.firebasestorage.app',
  messagingSenderId: '855837453649',
  appId: '1:855837453649:web:40c2ea49506946bbc4f770',
} as const;

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || DEFAULT.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULT.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || DEFAULT.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULT.storageBucket,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEFAULT.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || DEFAULT.appId,
};

/** Shown in development so it is obvious which project a build is pointed at. */
export const isDefaultProject = firebaseConfig.projectId === DEFAULT.projectId;
