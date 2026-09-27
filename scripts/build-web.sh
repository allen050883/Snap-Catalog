#!/usr/bin/env bash
# Builds the web app against one named environment.
#
#   ./scripts/build-web.sh staging
#   ./scripts/build-web.sh production
#
# Expo's dotenv loader overrides process.env rather than deferring to it, so
# `EXPO_PUBLIC_X=... expo export` does not work — whatever .env says wins. Loading
# the chosen file here and disabling that loader with EXPO_NO_DOTENV puts this
# script in charge of which environment a build targets.
set -euo pipefail

ENVIRONMENT="${1:-}"
if [[ -z "$ENVIRONMENT" ]]; then
  echo "用法：./scripts/build-web.sh <staging|production>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.$ENVIRONMENT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "找不到 $ENV_FILE" >&2
  echo "請從 .env.example 複製一份並填入該環境的設定。" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${EXPO_PUBLIC_API_URL:-}" ]]; then
  echo "$ENV_FILE 沒有設定 EXPO_PUBLIC_API_URL —— 建出來的網站無法做 AI 辨識。" >&2
  exit 1
fi

OUT="$ROOT/dist-$ENVIRONMENT"
echo "環境：$ENVIRONMENT"
echo "API  ：$EXPO_PUBLIC_API_URL"
echo "輸出 ：$OUT"
echo

rm -rf "$OUT"
# --clear is not optional here. EXPO_PUBLIC_* values are inlined during the Babel
# transform and Metro caches transform output, so building staging after production
# without it silently reuses the previous environment's URL — a production deploy
# quietly talking to the staging backend, with nothing on screen to show it.
EXPO_NO_DOTENV=1 npx expo export --clear --platform web --output-dir "$OUT"

echo
echo "完成。部署："
echo "  npx wrangler pages deploy $OUT --project-name=snaplocker-$ENVIRONMENT"
