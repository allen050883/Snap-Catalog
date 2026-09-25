# Snap Catalog

A native app for cataloging your collectibles (Rilakkuma, Sanrio, blind-box figures, or anything else) so you can check what you already own before buying a duplicate. Snap a photo, let AI suggest tags, tweak them, and search your collection later.

## Stack

- **Expo (React Native + TypeScript)**, file-based routing via `expo-router`
- **expo-sqlite** — local, on-device database, no backend required
- **expo-image-picker** — camera / photo library
- **Groq API** (vision model) — suggests name / character / series / category / color / tags from a photo
- **react-native-google-mobile-ads** — rewarded ads that unlock extra daily AI-tagging uses (see below)

### Web support is paused

This app briefly also targeted the web (`react-native-web`) as a static site. That's on hold, and **`expo export --platform web` currently fails to bundle** — `react-native-google-mobile-ads` is native-only and has no web implementation. If you pick the website back up later, the fix is to stub out the ads hook on web (a `use-bonus-analysis-ad.web.ts` that always reports "no bonus available") rather than importing the ads package there at all.

### Data is local to the device, not synced

There's no server — everything lives in that phone's local SQLite database. This was a deliberate simplicity/security trade-off: syncing across devices would require a backend service, which means an API key or login exposed in the client. If you outgrow this later, that's the point to revisit (e.g. Firebase with Google Sign-In, or a small self-hosted API).

## Setup

```bash
npm install
cp .env.example .env   # then paste your Groq API key into .env
```

### Testing on a device: dev client, not Expo Go

Rewarded ads are a native module, so **Expo Go can no longer run this app**. Instead, build a dev client once — free on Expo's build service:

```bash
npx eas build --profile development --platform android   # or ios
```

The first `eas build` will prompt you to log in (`eas login`, free Expo account) and link the project (`eas init`) if you haven't already.

Install the resulting build on your phone, then for every day-to-day run:

```bash
npx expo start --dev-client
```

This still gives you fast refresh / hot reload like Expo Go did — you only need to rebuild the dev client when a native dependency changes (e.g. you add another native SDK).

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

## Daily AI quota + rewarded ads

AI tagging (the Groq call) is rate-limited to keep API usage predictable: **5 free uses per calendar day** (device-local time, resets at midnight). Once that's used up, the Add screen offers "看廣告，多辨識 1 次" — watching one rewarded ad grants exactly one more use for that day. Manually filling in fields and saving is never gated; only the AI call is.

- `src/lib/usage.ts` — tracks `{ used, bonus }` per day in a SQLite table; `remaining = 5 + bonus - used`
- `src/hooks/use-bonus-analysis-ad.ts` — wraps `react-native-google-mobile-ads`'s `useRewardedAd` hook; on earning the reward, grants a bonus use and re-runs AI tagging on the pending photo automatically
- `app.json` and the ad unit ID in `use-bonus-analysis-ad.ts` currently use **Google's official test IDs** — they always serve a placeholder ad and never earn real revenue. Before shipping to real users: create an AdMob account, register the app, create a real rewarded ad unit, and swap both IDs in

## Project structure

```
src/
  app/                          # expo-router screens (index = list/search, add = capture + AI tag, item/[id] = view/edit/delete)
  components/                   # themed UI primitives + tag chip/editor
  hooks/use-bonus-analysis-ad.ts # rewarded-ad hook for the daily quota bonus
  lib/db.ts                     # SQLite schema + CRUD for items
  lib/usage.ts                  # daily AI-tagging quota tracking
  lib/groq.ts                   # Groq vision API call
eas.json                        # EAS Build profiles (needed for `eas build --profile development`)
```
