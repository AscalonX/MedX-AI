// Frame-edge probe (fix round 4): reports every time range where a visible text element (effective opacity >= 0.6,
// not blurred) is partly outside the 1920x1080 frame. Expected hits are only fast transitions (whip, push, zoom-through)
// and the decorative ghost line; a hold must never appear. Usage: node tools/edgecheck.mjs [step_s]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const PROMO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(process.env.MEDX_TOOLS || PROMO, 'package.json'))('playwright');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, s) => {
  const p = path.join(PROMO, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); s.end(d); });
}).listen(0);
const step = Number(process.argv[2] || 1 / 30);
const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?render=1`);
await page.evaluate(() => window.__ready());
const res = await page.evaluate((step) => {
  const effOpacity = (e) => { let o = 1; for (let n = e; n && n.id !== 'stage'; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; o *= parseFloat(cs.opacity); } return o; };
  const blurred = (e) => { for (let n = e; n && n.id !== 'stage'; n = n.parentElement) { const f = getComputedStyle(n).filter; if (f && /blur\((?!0px)/.test(f)) return true; } return false; };
  // leaf text carriers: elements with a non-empty own text node
  const leaves = Array.from(document.querySelectorAll('#stage *')).filter((e) => Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()));
  const label = (e) => (e.id ? '#' + e.id : '') + '.' + (e.className && e.className.baseVal === undefined ? String(e.className).split(' ')[0] : e.tagName) + ' "' + e.textContent.trim().slice(0, 28) + '"';
  const hits = {};
  for (let t = 0; t <= 60.0001; t += step) {
    window.__seek(t);
    for (const e of leaves) {
      if (e.closest('#ghostTh, .ghost, svg')) continue;
      const range = document.createRange(); range.selectNodeContents(e);
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const out = r.left < -1 || r.top < -1 || r.right > 1921 || r.bottom > 1081;
      const fully = r.right < 0 || r.left > 1920 || r.bottom < 0 || r.top > 1080;
      if (!out || fully) continue;
      if (effOpacity(e) < 0.6 || blurred(e)) continue;
      const k = label(e);
      (hits[k] = hits[k] || []).push(+t.toFixed(3));
    }
  }
  // compress to ranges
  const out = {};
  for (const [k, ts] of Object.entries(hits)) {
    const rs = []; let a = ts[0], b = ts[0];
    for (const t of ts.slice(1)) { if (t - b > step * 1.5) { rs.push([a, b]); a = t; } b = t; }
    rs.push([a, b]); out[k] = rs;
  }
  return out;
}, step);
await browser.close(); srv.close();
fs.mkdirSync(path.join(PROMO, 'out'), { recursive: true });
fs.writeFileSync(path.join(PROMO, 'out', 'edgecheck.json'), JSON.stringify(res, null, 1));
const rows = Object.entries(res).flatMap(([k, rs]) => rs.map(([a, b]) => [a, b, k])).sort((x, y) => x[0] - y[0]);
for (const [a, b, k] of rows) console.log(`${a.toFixed(2).padStart(6)}-${b.toFixed(2).padEnd(6)} (${(b - a + step).toFixed(2)} s)  ${k}`);
console.log(rows.length ? `${rows.length} range(s)` : 'no text crosses the frame edge');
