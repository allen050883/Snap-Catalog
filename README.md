# Snap Catalog

A native app for cataloging your collectibles (Rilakkuma, Sanrio, blind-box figures, or anything else) so you can check what you already own before buying a duplicate. Snap a photo, let AI suggest tags, tweak them, and search your collection later.

## Stack

- **Expo (React Native + TypeScript)**, file-based routing via `expo-router`
- **expo-sqlite** — local, on-device database, no backend required
- **expo-image-picker** — camera / photo library
- **Groq API** (vision model) — suggests name / character / series / category / color / tags from a photo

### Web support is paused

This app briefly also targeted the web (`react-native-web`) as a static site. That's on hold for now.

### Data is local to the device, not synced

There's no server — everything lives in that phone's local SQLite database. This was a deliberate simplicity/security trade-off: syncing across devices would require a backend service, which means an API key or login exposed in the client. If you outgrow this later, that's the point to revisit (e.g. Firebase with Google Sign-In, or a small self-hosted API).

## Setup

```bash
npm install
cp .env.example .env   # then paste your Groq API key into .env
npx expo start          # scan the QR code with Expo Go
```

### Groq API key

Get a free key at https://console.groq.com/keys and put it in `.env` as `EXPO_PUBLIC_GROQ_API_KEY`. `.env` is git-ignored — never commit it.

**Security note:** `EXPO_PUBLIC_*` variables are bundled into the client app. That's fine for a personal app you build and run yourself, but if you ever publish this app to the store for other people to install, anyone could extract the key from the app binary. For a shared/public app, move the Groq call behind your own small backend instead.

### Which model?

Defaults to `meta-llama/llama-4-scout-17b-16e-instruct` — Groq's fast, low-cost vision model, which is plenty accurate for identifying a figure's character/series/color from a photo. If you want to try squeezing out more accuracy at higher cost/latency, set `EXPO_PUBLIC_GROQ_VISION_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct` in `.env`.

## How it works

1. Tap **+** to add an item.
2. Take a photo or pick one from your library.
3. The app sends the photo to Groq's vision model, which suggests a name, character, series, category, color, and search tags — using up one of today's AI-tagging uses (see below).
4. Review/edit any field and the tags, then save. Everything — including the photo, stored as a base64 data URI — is kept locally in SQLite.
5. Use the search bar on the home screen to check by name, character, series, color, or tag whether you already own something before buying it again.

## Daily AI quota

AI tagging (the Groq call) is rate-limited to keep API usage predictable: **5 free uses per calendar day** (device-local time, resets at midnight). Once that's used up, you can still fill in every field and save manually — only the AI call itself is gated. Tracked in `src/lib/usage.ts` (a SQLite table with `{ used, bonus }` per day).

**Paused for now: rewarded ads to earn extra uses.** There was a working version of this — watching a rewarded ad granted one bonus use for the day — built with `react-native-google-mobile-ads`. It's commented out (not deleted) in `src/app/_layout.tsx` and `src/app/add.tsx`, and `usage.ts`'s `bonus` field/`grantBonusAnalysis()` are still there ready to be wired back up. Banner ads (a persistent on-screen ad strip) were discussed but never built.

To restore the ad-bonus flow later:
1. `npm install expo-dev-client@~57.0.19 react-native-google-mobile-ads@^17.2.0` (pin to whatever's current for your Expo SDK version at the time)
2. Re-add the `react-native-google-mobile-ads` plugin entry to `app.json`'s `plugins` (Google's test App IDs: `androidAppId: "ca-app-pub-3940256099942544~3347511713"`, `iosAppId: "ca-app-pub-3940256099942544~1458002511"`)
3. Uncomment the blocks in `_layout.tsx` and `add.tsx`
4. Since the ads SDK is a native module, Expo Go can't run the app anymore at that point — see the dev-client workflow: `npx eas build --profile development` once, then `npx expo start --dev-client` day to day (you'll need to add back an `eas.json` with a `development` build profile)

Before shipping the ad-bonus feature to real users: create an AdMob account, register the app, create a real rewarded ad unit, and swap the test IDs for real ones (both in `app.json` and in `use-bonus-analysis-ad.ts`'s `BONUS_AD_UNIT_ID`).

## Project structure

```
src/
  app/                          # expo-router screens (index = list/search, add = capture + AI tag, item/[id] = view/edit/delete)
  components/                   # themed UI primitives + tag chip/editor
  hooks/use-bonus-analysis-ad.ts # rewarded-ad hook for the daily quota bonus (currently unused, see above)
  lib/db.ts                     # SQLite schema + CRUD for items
  lib/usage.ts                  # daily AI-tagging quota tracking
  lib/groq.ts                   # Groq vision API call
```
