import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { auth } from '@/lib/firebase';

WebBrowser.maybeCompleteAuthSession();

// The web client ID (auto-created by Firebase when you enable Google sign-in) works
// for the web platform. Native (Expo Go included) needs its own OAuth client IDs —
// see README's "Firebase setup" section for how to create these in Google Cloud
// Console (Android needs your app's package name + a keystore SHA-1 fingerprint;
// iOS just needs the bundle identifier) and fill them in below.
const WEB_CLIENT_ID = '855837453649-77o096k4niirfvr3h7skeuvo4n4lb29k.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = ''; // TODO: paste your Android OAuth client ID here
const IOS_CLIENT_ID = ''; // TODO: paste your iOS OAuth client ID here

export function useGoogleSignIn() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID || undefined,
    iosClientId: IOS_CLIENT_ID || undefined,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    setSigningIn(true);
    setError(null);
    signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSigningIn(false));
  }, [response]);

  return {
    signIn: () => promptAsync(),
    isReady: !!request,
    signingIn,
    error,
  };
}
