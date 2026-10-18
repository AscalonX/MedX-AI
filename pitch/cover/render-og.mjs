// Renders pitch/cover/cover-v5-og.html to apps/web/app/opengraph-image.png (1200x630), the root Open Graph and
// Twitter card. Needs Playwright (PLAYWRIGHT_DIR or ~/medx-tools) and sharp (apps/web/node_modules).
// Usage from the repo root: node pitch/cover/render-og.mjs
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
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(ROOT, 'pitch/cover/cover-v5-og.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
// The card is 1200x630 (1.905:1): the top 1600x840 of the poster, scaled down.
const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1600, height: 840 } });
await browser.close();
const out = path.join(ROOT, 'apps/web/app/opengraph-image.png');
await sharp(png).resize(1200, 630).png({ compressionLevel: 9 }).toFile(out);
console.log('wrote', out);
