// Renders pitch/cover/cover-v6.html to pitch/cover/cover-v6.png (1600x900, the lablab submission cover).
// Needs Playwright (PLAYWRIGHT_DIR or ~/medx-tools) and sharp (apps/web/node_modules).
// Usage from the repo root: node pitch/cover/render-cover-v6.mjs
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
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(path.join(ROOT, 'pitch/cover/cover-v6.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const fontsOk = await page.evaluate(() => document.fonts.check('800 124px "Plus Jakarta Sans"'));
const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1600, height: 900 } });
await browser.close();
if (!fontsOk) throw new Error('Plus Jakarta Sans did not load (pitch/deck/fonts)');
const out = path.join(ROOT, 'pitch/cover/cover-v6.png');
await sharp(png).resize(1600, 900).png({ compressionLevel: 9 }).toFile(out);
console.log('wrote', out);
