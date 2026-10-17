#!/usr/bin/env bash
# Build the Expo patient app for web and publish it at /patient on the Next app.
# Requires apps/mobile/app.json  expo.experiments.baseUrl = "/patient"  (already set).
# Run before `docker build` / deploy. apps/web/public/patient is a build artifact: deploy it, do not hand-edit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${PATIENT_OUT:-$ROOT/apps/web/public/patient}"
cd "$ROOT/apps/mobile"
[ -d node_modules ] || npm ci
rm -rf dist
npx expo export --platform web
rm -rf "$OUT"
mkdir -p "$OUT"
cp -R dist/. "$OUT"/
echo "patient web build -> $OUT ($(du -sh "$OUT" | cut -f1)); serve at /patient"
