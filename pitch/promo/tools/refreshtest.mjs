// Simulates the UI-still refresh: serves the repo's current landing stills in place of assets/ui/*.webp
// and reports the asset warnings plus a screenshot, so the fallback rules can be checked without
// touching assets/. Usage: node tools/refreshtest.mjs <t> <out.png>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const PROMO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Repo copy: pitch/promo/tools -> repo root is two levels above pitch/promo (override with MEDX_REPO).
const LANDING = path.join(process.env.MEDX_REPO || path.resolve(PROMO, '..', '..'), 'apps', 'web', 'public', 'landing');
const { chromium } = createRequire(path.join(process.env.MEDX_TOOLS || PROMO, 'package.json'))('playwright');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => {
  const rel = decodeURIComponent(q.url.split('?')[0]);
  let p = path.join(PROMO, rel);
  const m = /^\/assets\/ui\/([^/]+\.webp)$/.exec(rel);
  if (m && fs.existsSync(path.join(LANDING, m[1]))) p = path.join(LANDING, m[1]);
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); s.end(d); });
}).listen(0);
const [t, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?render=1`);
await page.evaluate(() => window.__ready());
const w = await page.evaluate((tt) => {
  window.__seek(+tt);
  const used = Object.fromEntries(Object.entries(window.ASSETS.ui).map(([k, a]) => [k, a.__src]));
  return { warnings: window.__assetWarnings, err: window.__initError || null, used };
}, t);
console.log(JSON.stringify(w, null, 1));
if (out) await page.screenshot({ path: out });
await browser.close(); srv.close();
