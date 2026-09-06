# Snap Catalog

A mobile app for cataloging your collectibles (Rilakkuma, Sanrio, blind-box figures, or anything else) so you can check what you already own before buying a duplicate. Snap a photo, let AI suggest tags, tweak them, and search your collection later.

## Stack

- **Expo (React Native + TypeScript)**, file-based routing via `expo-router`
- **expo-sqlite** — local on-device database, no backend required
- **expo-image-picker** — camera / photo library
- **Groq API** (vision model) — suggests name / character / series / category / color / tags from a photo

## Setup

```bash
npm install
cp .env.example .env   # then paste your Groq API key into .env
npx expo start
```

Open the project in Expo Go (scan the QR code) or a simulator.

### Groq API key

Get a free key at https://console.groq.com/keys and put it in `.env` as `EXPO_PUBLIC_GROQ_API_KEY`. `.env` is git-ignored — never commit it.

**Security note:** `EXPO_PUBLIC_*` variables are bundled into the client app. That's fine for a personal app you build and run yourself, but if you ever publish this app to the store for other people to install, anyone could extract the key from the app binary. For a shared/public app, move the Groq call behind your own small backend instead.

### Which model?

Defaults to `meta-llama/llama-4-scout-17b-16e-instruct` — Groq's fast, low-cost vision model, which is plenty accurate for identifying a figure's character/series/color from a photo. If you want to try squeezing out more accuracy at higher cost/latency, set `EXPO_PUBLIC_GROQ_VISION_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct` in `.env`.

## How it works

1. Tap **+** to add an item.
2. Take a photo or pick one from your library.
3. The app sends the photo to Groq's vision model, which suggests a name, character, series, category, color, and search tags.
4. Review/edit any field and the tags, then save. Everything is stored locally in SQLite (photos are copied into the app's document directory).
5. Use the search bar on the home screen to check by name, character, series, color, or tag whether you already own something before buying it again.

## Project structure

```
src/
  app/            # expo-router screens (index = list/search, add = capture + AI tag, item/[id] = view/edit/delete)
  components/     # themed UI primitives + tag chip/editor
  lib/db.ts       # SQLite schema + CRUD
  lib/groq.ts     # Groq vision API call
```
