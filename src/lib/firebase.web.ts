import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Web has its own persistence (browser storage) built into getAuth — no
// AsyncStorage/getReactNativePersistence needed (and that RN-only API isn't even
// exported from the browser build, so it can't be imported here at all).
const firebaseConfig = {
  apiKey: 'AIzaSyAJLyeBfSrR8MKAjYwdBtCITJcmts1OI1w',
  authDomain: 'snap-catalog-a0c41.firebaseapp.com',
  projectId: 'snap-catalog-a0c41',
  storageBucket: 'snap-catalog-a0c41.firebasestorage.app',
  messagingSenderId: '855837453649',
  appId: '1:855837453649:web:40c2ea49506946bbc4f770',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
