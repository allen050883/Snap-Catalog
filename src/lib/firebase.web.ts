import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import { firebaseConfig } from '@/lib/firebase-config';

// Web has its own persistence (browser storage) built into getAuth — no
// AsyncStorage/getReactNativePersistence needed (and that RN-only API isn't even
// exported from the browser build, so it can't be imported here at all).

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
