// Generates docs/design/mascot/*.svg and preview.html from packages/shared/src/mascot.ts (single source).
// Run: node docs/design/mascot/build.mjs   (Node 23+ strips TS types natively)
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const { MASCOT_POSES, mascotSvg } = await import(join(here, "../../../packages/shared/src/mascot.ts"));
for (const p of MASCOT_POSES) writeFileSync(join(here, `fin-${p}.svg`), mascotSvg(p, 240, `fin-${p}`) + "\n");
const cell = (p, s, bg) => `<figure style="margin:0;display:grid;place-items:center;gap:6px;background:${bg};border-radius:22px;padding:16px">${mascotSvg(p, s, `${p}-${s}-${bg.length}`)}<figcaption style="font:600 13px system-ui;color:${bg.startsWith("linear") ? "#fff" : "#45566A"}">${p} ${s}px</figcaption></figure>`;
const grad = "linear-gradient(135deg,#0A8077,#1A5FC4)";
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:24px;background:#EEF3F6;font-family:system-ui">
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px">${MASCOT_POSES.map((p) => cell(p, 240, "#FFFFFF")).join("")}</div>
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-top:16px">${MASCOT_POSES.map((p) => cell(p, 120, grad)).join("")}</div>
<div style="display:flex;gap:16px;margin-top:16px;align-items:center">${MASCOT_POSES.map((p) => cell(p, 48, "#FFFFFF")).join("")}</div></body>`;
writeFileSync(join(here, "preview.html"), html);
console.log("ok", MASCOT_POSES.length);
