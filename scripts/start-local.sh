#!/usr/bin/env bash
# Start the configured local demo. Build again after changing application code.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/web"
if [ ! -f "$APP/.env.local" ]; then
  echo "Create apps/web/.env.local from .env.example first. See docs/LOCAL-SETUP.md." >&2
  exit 1
fi
if [ ! -f "$APP/.next/BUILD_ID" ]; then
  npm --prefix "$APP" run build
fi
RUNTIME="$APP/.next/standalone/apps/web"
# Next's standalone bundle leaves static/public assets to the deployment wrapper.
mkdir -p "$RUNTIME/.next/static" "$RUNTIME/public"
cp -R "$APP/.next/static/." "$RUNTIME/.next/static/"
cp -R "$APP/public/." "$RUNTIME/public/"
export HOSTNAME=127.0.0.1
export PORT="${PORT:-3000}"
exec node --env-file="$APP/.env.local" "$RUNTIME/server.js"
