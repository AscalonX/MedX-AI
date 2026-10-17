// Writes poster-ready Fin SVGs (no ground shadow) from packages/shared/src/mascot.ts.
// Run from repo root: node pitch/cover/img/build-fin.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const m = await import(join(here, "../../../packages/shared/src/mascot.ts"));
for (const pose of ["wave", "listening"]) {
  const svg = m.mascotSvg(pose, 600, `p-${pose}`).replace(/<path d="[^"]*" fill="#0F2D50" opacity="0.14"\/>/, "");
  writeFileSync(join(here, `fin-${pose}-poster.svg`), svg + "\n");
}
console.log("ok");
