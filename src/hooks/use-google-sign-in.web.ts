import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type AuthError,
} from 'firebase/auth';
import { useCallback, useState } from 'react';

import { auth } from '@/lib/firebase';

// Web counterpart to use-google-sign-in.ts. The native hook drives the OAuth flow
// itself via expo-auth-session, which on web redirects back to window.location's
// origin (`http://localhost:8081` in dev) — a URI the Firebase-created Web OAuth
// client doesn't register, so Google rejects it with redirect_uri_mismatch and you'd
// have to hand-add every origin you ever serve from in the Google Cloud Console.
//
// Firebase's own signInWithPopup avoids all of that: it redirects to the auth
// handler on the Firebase-hosted domain, which Firebase already registered on that
// same OAuth client, and gates callers by Authentication -> Settings -> Authorized
// domains instead (localhost is authorized by default in every Firebase project).
const provider = new GoogleAuthProvider();
// Otherwise a browser already signed into exactly one Google account skips the
// chooser, which makes testing the multi-account case impossible.
provider.setCustomParameters({ prompt: 'select_account' });

function isAuthError(err: unknown): err is AuthError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

export function useGoogleSignIn() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    try {
      // No need to do anything with the credential: onAuthStateChanged
      // (use-auth-user.ts) is what the app actually renders off.
      await signInWithPopup(auth, provider);
    } catch (err) {
      const code = isAuthError(err) ? err.code : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // Dismissing the popup is a cancel, not a failure — leave the screen clean.
      } else if (code === 'auth/popup-blocked') {
        // Popup blockers can still fire despite the button press that got us here.
        // A full-page redirect can't be blocked; onAuthStateChanged picks the
        // session up when the browser comes back.
        await signInWithRedirect(auth, provider);
        return;
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  return {
    signIn,
    // Nothing to load first here — the native hook has to build an AuthRequest.
    isReady: true,
    signingIn,
    error,
  };
}
