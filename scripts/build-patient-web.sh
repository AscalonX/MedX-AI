#!/usr/bin/env bash
# Build the Expo patient app for web and publish it at /patient on the Next app.
# Requires apps/mobile/app.json  expo.experiments.baseUrl = "/patient"  (already set).
# Run before `docker build` / deploy. apps/web/public/patient is a build artifact: deploy it, do not hand-edit.
#
# Freshness stamp: public/patient/source.sha is the sha256 of the sources this export was built from, so a stale
# export fails apps/web/app/patient-stamp.test.ts. Algorithm (the test repeats it exactly):
#   files  = every regular file under apps/mobile/src and packages/shared/src (names starting with "." skipped),
#            as repo-relative paths with "/" separators, sorted by plain string order;
#   for each file: update(path + "\n"), update(bytes with every CRLF turned into LF), update("\n");
#   source.sha = lowercase hex digest + "\n".
# The hash is taken BEFORE the export, so an edit made while Metro runs makes the stamp stale, never falsely fresh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${PATIENT_OUT:-$ROOT/apps/web/public/patient}"

SHA="$(cd "$ROOT" && node -e '
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name.startsWith(".")) return [];
  const p = dir + "/" + e.name;
  return e.isDirectory() ? walk(p) : e.isFile() ? [p] : [];
});
const files = ["apps/mobile/src", "packages/shared/src"].flatMap(walk).sort();
const h = createHash("sha256");
for (const f of files) {
  h.update(f + "\n");
  h.update(Buffer.from(fs.readFileSync(f).toString("latin1").replace(/\r\n/g, "\n"), "latin1"));
  h.update("\n");
}
process.stdout.write(h.digest("hex"));
')"
echo "patient sources sha256: $SHA"

cd "$ROOT/apps/mobile"
[ -d node_modules ] || npm ci
rm -rf dist
npx expo export --platform web
rm -rf "$OUT"
mkdir -p "$OUT"
cp -R dist/. "$OUT"/
printf '%s\n' "$SHA" > "$OUT/source.sha"
echo "patient web build -> $OUT ($(du -sh "$OUT" | cut -f1)); serve at /patient; source.sha $SHA"
