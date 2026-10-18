#!/usr/bin/env node
// One command from the repo: node pitch/promo/rerender.mjs [render.mjs flags]
//   1. vendor/gsap.min.js + fonts/   setup-vendor.mjs, only when a file is missing
//   2. audio/score.wav               audio/make_score.py, only when missing (deterministic, about 35 s)
//   3. assets/                       tools/sync-assets.mjs: UI stills from apps/web/public/landing (skip with --no-sync)
//   4. render.mjs                    with every other flag passed through (default: full 60 fps render)
// Env: MEDX_PYTHON (python with numpy, default "python"), MEDX_TOOLS, MEDX_REPO, MEDX_SHOTS, MEDX_FFMPEG.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROMO = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const noSync = argv.includes('--no-sync');
const renderArgs = argv.filter((a) => a !== '--no-sync');
const has = (f) => fs.existsSync(path.join(PROMO, f));

function run(label, cmd, args) {
  console.log(`[rerender] ${label}: ${[cmd, ...args].join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: PROMO, stdio: 'inherit' });
  if (r.error) { console.error(`[rerender] ${label} failed to start: ${r.error.message}`); process.exit(1); }
  if (r.status !== 0) { console.error(`[rerender] ${label} exited with ${r.status}`); process.exit(r.status ?? 1); }
}

if (!has('vendor/gsap.min.js') || !has('fonts/fonts.css')) run('vendor', process.execPath, ['setup-vendor.mjs']);
const needsScore = !renderArgs.includes('--no-audio') && !renderArgs.includes('--frames-only') && !renderArgs.includes('--serve');
if (needsScore && !has('audio/score.wav')) run('score', process.env.MEDX_PYTHON || 'python', ['-I', path.join('audio', 'make_score.py')]);
if (!noSync) run('assets', process.execPath, [path.join('tools', 'sync-assets.mjs')]);
run('render', process.execPath, ['render.mjs', ...renderArgs]);
