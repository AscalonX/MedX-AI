// Renders pitch/deck/deck.html to pitch/deck/MedX-deck.pdf (one 1920x1080 page per slide) and pitch/deck/png/slide-N.png.
// Needs Playwright (PLAYWRIGHT_DIR or ~/medx-tools). Usage from the repo root: node pitch/deck/render.mjs
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

const deck = pathToFileURL(path.join(ROOT, 'pitch/deck/deck.html')).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(deck);
await page.evaluate(() => document.fonts.ready);
const fontsOk = await page.evaluate(() => document.fonts.check('800 64px "Plus Jakarta Sans"') && document.fonts.check('400 24px "Plus Jakarta Sans"'));
if (!fontsOk) throw new Error('Plus Jakarta Sans did not load (pitch/deck/fonts)');
await page.waitForTimeout(400);
const slides = await page.locator('section.slide').count();
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: path.join(ROOT, 'pitch/deck/MedX-deck.pdf'), width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
await page.emulateMedia({ media: 'screen' });
for (let i = 1; i <= slides; i++) {
  await page.locator('section.slide').nth(i - 1).screenshot({ path: path.join(ROOT, `pitch/deck/png/slide-${i}.png`) });
}
await browser.close();
console.log(`wrote MedX-deck.pdf and ${slides} PNGs`);
