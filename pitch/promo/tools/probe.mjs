// Debug probe: load the composition, run JS snippets against it after given seeks.
// Usage: node tools/probe.mjs "<js expression returning JSON-able>" t1 t2 ...
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const PROMO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(process.env.MEDX_TOOLS || PROMO, 'package.json'))('playwright');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.wav': 'audio/wav', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, s) => {
  const p = path.join(PROMO, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); s.end(d); });
}).listen(0);
const port = srv.address().port;
const [expr, ...times] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.evaluate(() => window.__ready());
for (const t of times) {
  const out = await page.evaluate(([tt, ex]) => { window.__seek(+tt); return eval(ex); }, [t, expr]);
  console.log(`t=${t}`, JSON.stringify(out));
}
const shot = process.env.SHOT;
if (shot) { await page.screenshot({ path: shot }); console.log('shot', shot); }
await browser.close(); srv.close();
