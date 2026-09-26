import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase's web config is meant to be public — access control is enforced by the
// Firestore security rules (see README), not by hiding these values.
const firebaseConfig = {
  apiKey: 'AIzaSyAJLyeBfSrR8MKAjYwdBtCITJcmts1OI1w',
  authDomain: 'snap-catalog-a0c41.firebaseapp.com',
  projectId: 'snap-catalog-a0c41',
  storageBucket: 'snap-catalog-a0c41.firebasestorage.app',
  messagingSenderId: '855837453649',
  appId: '1:855837453649:web:40c2ea49506946bbc4f770',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(createAsyncStorage('firebase-auth')),
});

export const db = getFirestore(app);
