// Renders docs/readme/banner.html to docs/readme/banner.png (README banner, 1600x800).
// Needs Playwright (PLAYWRIGHT_DIR or ~/medx-tools) and sharp (apps/web/node_modules).
// Usage from the repo root: node docs/readme/render-banner.mjs
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function load(name, dirs) {
  for (const d of dirs.filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(d), 'noop.js'))(name); } catch { /* next */ }
  }
  throw new Error(`${name} not found in ${dirs.filter(Boolean).join(', ')}`);
}
const { chromium } = load('playwright', [process.env.PLAYWRIGHT_DIR, ROOT, path.join(ROOT, 'apps/web'), path.join(os.homedir(), 'medx-tools')]);
const sharp = load('sharp', [path.join(ROOT, 'apps/web'), ROOT]);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(path.join(ROOT, 'docs/readme/banner.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const fontsOk = await page.evaluate(() => document.fonts.check('800 92px "Plus Jakarta Sans"'));
const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 640 } });
await browser.close();
if (!fontsOk) throw new Error('Plus Jakarta Sans did not load (pitch/promo/fonts)');
const out = path.join(ROOT, 'docs/readme/banner.png');
await sharp(png).resize(1600, 800).png({ compressionLevel: 9, palette: true, quality: 92 }).toFile(out);
console.log('wrote', out);
