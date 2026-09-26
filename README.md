# Snap Catalog

A native app for cataloging your collectibles (Rilakkuma, Sanrio, blind-box figures, or anything else) so you can check what you already own before buying a duplicate. Snap a photo, let AI suggest tags, tweak them, and search your collection later. Sign in with Google and your catalog follows you across devices.

## Stack

- **Expo (React Native + TypeScript)**, file-based routing via `expo-router`
- **Firebase Authentication** (Google Sign-In) + **Cloud Firestore** — your catalog is scoped to your Google account and synced across every device you sign into
- **expo-image-picker** + **expo-image-manipulator** — camera / photo library, then resize+compress before upload
- **Groq API** (vision model) — suggests name / character / series / category / color / tags from a photo

### Web support is paused

This app briefly also targeted the web (`react-native-web`) as a static site. That's on hold for now, though `expo export --platform web` and `npx expo start --web` currently still work (the Firebase/auth pieces are cross-platform) — it just isn't the focus.

### Testing on a device: dev client, not Expo Go

Two things here are native modules that Expo Go doesn't include: `@react-native-async-storage/async-storage` (Firebase Auth session persistence) and the redirect-URI requirements of native Google Sign-In (see below). Build a dev client once — free on Expo's build service:

```bash
npx eas build --profile development --platform android   # or ios
```

The first `eas build` will prompt you to log in (`eas login`, free Expo account) and link the project (`eas init`) if you haven't already. Install the resulting build on your phone, then for day-to-day development:

```bash
npx expo start --dev-client
```

This still gives you fast refresh / hot reload — you only need to rebuild the dev client when a native dependency changes.

## Firebase setup

The Firebase project (`snap-catalog-a0c41`) and its web config are already wired up in `src/lib/firebase.ts` / `firebase.web.ts` — that config is meant to be public, security is enforced by Firestore rules, not by hiding it. Already done, for reference:

- **Firestore** database created, with these rules published (each user can only read/write their own `users/{uid}/items/*`):
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/items/{itemId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
- **Authentication → Sign-in method → Google** enabled
- **Cloud Storage skipped on purpose** — Firebase now requires the paid Blaze plan (still free at low usage, but needs a credit card) to use Storage at all. Photos are instead resized/compressed (see `lib/compress-photo.ts`) and stored as a base64 string directly on the Firestore item document, which stays under Firestore's 1 MiB per-document limit.

### Native OAuth client IDs

`src/hooks/use-google-sign-in.ts` has **Web** and **iOS** OAuth client IDs filled in already. **Android is still missing** — Google Sign-In will fail on an Android build until it's added:

1. Get your dev-client build's SHA-1 fingerprint via `eas credentials` (select Android; it'll show or generate a keystore).
2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=snap-catalog-a0c41) (make sure the project selector shows `snap-catalog-a0c41` — it's easy to accidentally land in an unrelated default project) → Create Credentials → OAuth client ID → **Android** → package name `com.allen050883.snapcatalog` + that SHA-1.
3. Paste the resulting client ID into `src/hooks/use-google-sign-in.ts`'s `ANDROID_CLIENT_ID`.

Both native client IDs also needed a redirect URI fix: `expo-auth-session`'s Google provider defaults the native redirect to `${bundleId}:/oauthredirect`, but this app doesn't register that as a URL scheme — only `app.json`'s top-level `scheme` (`snapcatalog`) is registered. `useGoogleSignIn` passes an explicit `{ native: 'snapcatalog:/oauthredirect' }` redirect override to fix this; if Android sign-in still fails to return to the app after adding the client ID above, that's the first thing to check.

### Groq API key

Get a free key at https://console.groq.com/keys and put it in `.env` as `EXPO_PUBLIC_GROQ_API_KEY`. `.env` is git-ignored — never commit it.

**Security note:** `EXPO_PUBLIC_*` variables are bundled into the client app. That's fine for a personal app you build and run yourself, but if you ever publish this app to the store for other people to install, anyone could extract the key from the app binary. For a shared/public app, move the Groq call behind your own small backend instead.

### Which model?

Defaults to `meta-llama/llama-4-scout-17b-16e-instruct` — Groq's fast, low-cost vision model, which is plenty accurate for identifying a figure's character/series/color from a photo. If you want to try squeezing out more accuracy at higher cost/latency, set `EXPO_PUBLIC_GROQ_VISION_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct` in `.env`.

## Setup

```bash
npm install
cp .env.example .env   # then paste your Groq API key into .env
```

Then either `npx expo start --web` (works today, no native OAuth setup needed) or the dev-client workflow above for a real device.

## How it works

1. Sign in with Google.
2. Tap **+** to add an item.
3. Take a photo or pick one from your library.
4. The app sends the photo to Groq's vision model, which suggests a name, character, series, category, color, and search tags — using up one of today's AI-tagging uses (see below).
5. Review/edit any field and the tags, then save. Everything — including the photo, resized and stored as a base64 string — is kept in Firestore under your account.
6. Use the search bar on the home screen to check by name, character, series, color, or tag whether you already own something before buying it again. Sign in with the same Google account on another device and the same catalog is there.

## Daily AI quota

AI tagging (the Groq call) is rate-limited to keep API usage predictable: **5 free uses per calendar day** (device-local time, resets at midnight). Once that's used up, you can still fill in every field and save manually — only the AI call itself is gated. Tracked in `src/lib/usage.ts` (a local SQLite table with `{ used, bonus }` per day — this one stays local/per-device on purpose, since it's about capping your own Groq usage, not catalog data).

**Paused for now: rewarded ads to earn extra uses.** There was a working version of this — watching a rewarded ad granted one bonus use for the day — built with `react-native-google-mobile-ads`. It's commented out (not deleted) in `src/app/_layout.tsx` and `src/app/add.tsx`, and `usage.ts`'s `bonus` field/`grantBonusAnalysis()` are still there ready to be wired back up. Banner ads (a persistent on-screen ad strip) were discussed but never built.

To restore the ad-bonus flow later:
1. `npm install react-native-google-mobile-ads@^17.2.0` (pin to whatever's current for your Expo SDK version at the time — `expo-dev-client` is already installed now for the Google Sign-In work above)
2. Re-add the `react-native-google-mobile-ads` plugin entry to `app.json`'s `plugins` (Google's test App IDs: `androidAppId: "ca-app-pub-3940256099942544~3347511713"`, `iosAppId: "ca-app-pub-3940256099942544~1458002511"`)
3. Uncomment the blocks in `_layout.tsx` and `add.tsx`, and restore `src/hooks/use-bonus-analysis-ad.ts`'s body (currently commented out)

Before shipping the ad-bonus feature to real users: create an AdMob account, register the app, create a real rewarded ad unit, and swap the test IDs for real ones (both in `app.json` and in `use-bonus-analysis-ad.ts`'s `BONUS_AD_UNIT_ID`).

## Project structure

```
src/
  app/                          # expo-router screens (index = list/search, add = capture + AI tag, item/[id] = view/edit/delete)
  components/
    login-screen.tsx            # shown when signed out
  hooks/
    use-auth-user.ts            # onAuthStateChanged wrapper
    use-google-sign-in.ts       # expo-auth-session Google flow -> Firebase credential
    use-bonus-analysis-ad.ts    # rewarded-ad hook for the daily quota bonus (currently unused, see above)
  lib/
    firebase.ts / firebase.web.ts  # Firebase app/auth/Firestore init (native vs web persistence)
    db.ts                       # Firestore CRUD for items (users/{uid}/items/{itemId})
    compress-photo.ts           # resize+compress a photo to fit Firestore's 1 MiB doc limit
    usage.ts                    # daily AI-tagging quota tracking (local, per-device)
    groq.ts                     # Groq vision API call
  types/firebase-auth-rn.d.ts   # type-only shim for a firebase/auth typing gap (see file comment)
eas.json                        # EAS Build profiles (needed for `eas build --profile development`)
```
