# Snap Catalog

An app (and website — same codebase) for cataloging your collectibles (Rilakkuma, Sanrio, blind-box figures, or anything else) so you can check what you already own before buying a duplicate. Snap a photo, let AI suggest tags, tweak them, and search your collection later.

## Stack

- **Expo (React Native + TypeScript)**, file-based routing via `expo-router` — the same code runs as a native app (iOS/Android via Expo Go, or a real build) and as a website (`react-native-web`)
- **expo-sqlite** — local, on-device/on-browser database, no backend required
- **expo-image-picker** — camera / photo library, works on native and in the browser
- **Groq API** (vision model) — suggests name / character / series / category / color / tags from a photo

### Important: data is per-device/per-browser, not synced

There's no server — each platform keeps its own local database (SQLite file on a phone, browser storage on a website). Opening the site in a different browser or on a different phone will **not** show the same items. This was a deliberate simplicity/security trade-off: syncing across the app and the website would require a backend service, which means an API key or login exposed in the client. If you outgrow this later, that's the point to revisit (e.g. Supabase with auth, or a small self-hosted API).

## Setup

```bash
npm install
cp .env.example .env   # then paste your Groq API key into .env
npx expo start          # native (Expo Go / simulator)
npx expo start --web    # website, opens in your browser
```

### Groq API key

Get a free key at https://console.groq.com/keys and put it in `.env` as `EXPO_PUBLIC_GROQ_API_KEY`. `.env` is git-ignored — never commit it.

**Security note:** `EXPO_PUBLIC_*` variables are bundled into the client app. That's fine for a personal app you build and run yourself, but if you ever publish this app to the store for other people to install, anyone could extract the key from the app binary. For a shared/public app, move the Groq call behind your own small backend instead.

### Which model?

Defaults to `meta-llama/llama-4-scout-17b-16e-instruct` — Groq's fast, low-cost vision model, which is plenty accurate for identifying a figure's character/series/color from a photo. If you want to try squeezing out more accuracy at higher cost/latency, set `EXPO_PUBLIC_GROQ_VISION_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct` in `.env`.

## How it works

1. Tap **+** to add an item.
2. Take a photo or pick one from your library (on web this opens your OS's file/camera picker).
3. The app sends the photo to Groq's vision model, which suggests a name, character, series, category, color, and search tags.
4. Review/edit any field and the tags, then save. Everything — including the photo, stored as a base64 data URI — is kept locally in SQLite.
5. Use the search bar on the home screen to check by name, character, series, color, or tag whether you already own something before buying it again.

## Deploying the website

`npx expo export --platform web` produces a static site in `dist/`. Host it anywhere that serves static files (Vercel, Netlify, GitHub Pages, `npx serve dist`, etc.) — no backend needed, since storage lives entirely in that browser.

## Project structure

```
src/
  app/            # expo-router screens (index = list/search, add = capture + AI tag, item/[id] = view/edit/delete)
  components/     # themed UI primitives + tag chip/editor
  lib/db.ts       # SQLite schema + CRUD
  lib/groq.ts     # Groq vision API call
metro.config.js   # registers .wasm as an asset so expo-sqlite's web engine bundles correctly
```
