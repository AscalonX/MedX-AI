#!/usr/bin/env node
// Copies every image the film uses into pitch/promo/assets/<group>/<same file name>
// and regenerates the QR code. Re-run after a UI refresh: files are replaced under the
// SAME names, so the composition re-renders unchanged (assets.js is the one map).
//
// Sources (repo copy; every root can be overridden by an env var):
//   assets/ui/*.webp  <- <repo>/apps/web/public/landing/<name>        (MEDX_REPO, default: two levels above pitch/promo)
//   assets/ui/*.png   <- MEDX_SHOTS/<name> when set (the w20 full-page captures, not in the repo),
//                        otherwise the frozen copies in assets/ui-verified/
//   assets/logo/*.svg <- <repo>/docs/design/logo/<name>
//   assets/brand/*    <- committed PNGs; replaced only when MEDX_BRAND is set (brand-out folder)
//   assets/data/qr.svg <- generated with the qrcode package (kept as committed if it is not installed)
// A landing still that is missing falls back to its frozen copy in assets/ui-verified/ with a warning.
// A still whose layout changed (other aspect or an odd pixel ratio) is still copied: timeline.js then
// renders the frozen copy and prints "[promo] asset warnings" until the crops are re-measured.
//
// Usage: node pitch/promo/tools/sync-assets.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const PROMO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const REPO = process.env.MEDX_REPO || path.resolve(PROMO, '..', '..');
const VERIFIED = path.join(PROMO, 'assets', 'ui-verified');
const ROOTS = {
  LANDING: path.join(REPO, 'apps', 'web', 'public', 'landing'),
  SHOTS: process.env.MEDX_SHOTS || VERIFIED,
  LOGO: path.join(REPO, 'docs', 'design', 'logo'),
  BRAND: process.env.MEDX_BRAND || null,
};
// [root, file name, optional]
const FILES = {
  ui: [
    ['LANDING', 'patient-voice.webp'], ['LANDING', 'nurse-case.webp'], ['LANDING', 'consult.webp'],
    ['LANDING', 'pharmacy-verify.webp'], ['LANDING', 'pharmacy-dispense.webp'], ['LANDING', 'patient-pickup.webp'],
    ['LANDING', 'trace.webp'], ['LANDING', 'hero-consult.webp'],
    ['SHOTS', 'case.png'], ['SHOTS', 'consult-full.png'], ['SHOTS', 'pverify.png'],
    ['SHOTS', 'pverify-full.png'], ['SHOTS', 'pdisp.png'], ['SHOTS', 'pdisp-full.png'],
  ],
  logo: [['LOGO', 'lockup-color.svg'], ['LOGO', 'lockup-white.svg'], ['LOGO', 'mark-color.svg'], ['LOGO', 'mark-white.svg']],
  brand: [['BRAND', 'fin3d-listening-512.png'], ['BRAND', 'fin3d-pointing-512.png']],
};

if (!fs.existsSync(path.join(REPO, 'apps', 'web'))) {
  throw new Error(`repo root not found at ${REPO} (set MEDX_REPO to the MedX-AI checkout)`);
}

const rel = (p) => path.relative(REPO, p) || p;
let copied = 0;
const warnings = [];
for (const [group, list] of Object.entries(FILES)) {
  const dir = path.join(PROMO, 'assets', group);
  for (const [root, name, optional] of list) {
    if (!ROOTS[root]) continue; // e.g. brand without MEDX_BRAND: keep the committed file
    let src = path.join(ROOTS[root], name);
    if (!fs.existsSync(src)) {
      const frozen = path.join(VERIFIED, name);
      if (group === 'ui' && fs.existsSync(frozen)) {
        warnings.push(`${name}: not found in ${rel(ROOTS[root])}, using the frozen copy`);
        src = frozen;
      } else if (optional) {
        continue;
      } else {
        throw new Error(`missing source ${src}`);
      }
    }
    if (DRY) { console.log(`[sync-assets] ${group}/${name} <- ${rel(src)}`); continue; }
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, path.join(dir, name));
    copied++;
  }
}

// QR: local MIT library, ECC M, 4-module quiet zone, ink on white.
const qrFile = path.join(PROMO, 'assets', 'data', 'qr.svg');
let qrNote = 'assets/data/qr.svg';
try {
  const require = createRequire(path.join(process.env.MEDX_TOOLS || PROMO, 'package.json'));
  const QRCode = require('qrcode');
  const svg = await QRCode.toString('https://medx.areazeroai.com', {
    type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#0F1E2EFF', light: '#FFFFFFFF' },
  });
  if (!DRY) { fs.mkdirSync(path.dirname(qrFile), { recursive: true }); fs.writeFileSync(qrFile, svg); }
  qrNote += ' (generated)';
} catch (e) {
  if (!fs.existsSync(qrFile)) throw new Error(`qrcode package not installed and ${qrFile} is missing (npm --prefix pitch/promo install)`);
  qrNote += ' (kept the committed file: qrcode package not installed)';
}

for (const w of warnings) console.log(`[sync-assets] WARN ${w}`);
console.log(`[sync-assets] ${DRY ? 'dry run, nothing copied' : `copied ${copied} files`} + ${qrNote} | landing: ${ROOTS.LANDING} | shots: ${ROOTS.SHOTS}`);
