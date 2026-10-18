// Readability probe (fix round 4): for every headline / secondary line, the longest window in which ALL of its
// words are fully readable: effective opacity >= 0.97 (element and every ancestor), no blur filter, each word inside
// its own reveal mask (.w) and inside its slot mask, and the line fully inside the 1920x1080 frame.
// Usage: node tools/readcheck.mjs [step_s=0.0166667]   -> prints a table and writes out/readcheck.json
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
const step = Number(process.argv[2] || 1 / 60);
const browser = await chromium.launch({ args: ['--force-device-scale-factor=1', '--force-color-profile=srgb', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?render=1`);
await page.evaluate(() => window.__ready());
const IDS = ['s02h', 's03h', 's03src', 's04tag', 's05h', 's06h1', 's06h2', 's07h', 's08h', 's09h', 's09s', 's10h1', 's10h2', 's11h1', 's11h2', 's11s',
  's12h1', 's12h2', 'thai13', 's13h', 's14h', 'trSum', 's15h1', 's15h2', 's16h', 's17h', 's18tag', 'claim'];
const res = await page.evaluate(({ IDS, step }) => {
  const out = {};
  const effOpacity = (e) => { let o = 1; for (let n = e; n && n.id !== 'stage'; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; o *= parseFloat(cs.opacity); } return o; };
  const blurred = (e) => { for (let n = e; n && n.id !== 'stage'; n = n.parentElement) { const f = getComputedStyle(n).filter; if (f && f !== 'none' && !/blur\(0px\)/.test(f) && /blur/.test(f)) return true; } return false; };
  const inside = (a, b, tol = 1) => a.left >= b.left - tol && a.right <= b.right + tol && a.top >= b.top - tol && a.bottom <= b.bottom + tol;
  const FRAME = { left: 0, top: 0, right: 1920, bottom: 1080 };
  const ok = (el) => {
    const words = el.querySelectorAll('.wi');
    const parts = words.length ? Array.from(words) : [el];
    const slot = el.closest('.slot');
    const sr = slot && slot.getBoundingClientRect();
    for (const w of parts) {
      if (effOpacity(w) < 0.97 || blurred(w)) return false;
      const r = w.getBoundingClientRect();
      if (r.width === 0) return false;
      if (!inside(r, FRAME)) return false;
      const mask = w.parentElement && w.parentElement.classList.contains('w') ? w.parentElement.getBoundingClientRect() : null;
      if (mask && !inside({ left: r.left, right: r.right, top: r.top + r.height * 0.15, bottom: r.bottom - r.height * 0.25 }, mask, 2)) return false;
      if (sr && !inside({ left: r.left, right: r.right, top: r.top + r.height * 0.2, bottom: r.bottom - r.height * 0.2 }, sr, 2)) return false;
    }
    // an element-level clip-path reveal must be complete
    const cp = getComputedStyle(el).clipPath;
    if (cp && cp !== 'none') { const m = /inset\(([^)]*)\)/.exec(cp); if (m) { const v = m[1].split(/\s+/).map(parseFloat); if (v[1] > 1 || v[3] > 1) return false; } }
    return true;
  };
  for (const id of IDS) out[id] = { windows: [] };
  let cur = {};
  for (let t = 0; t <= 60.0001; t += step) {
    window.__seek(t);
    for (const id of IDS) {
      const el = document.getElementById(id);
      const good = el && ok(el);
      if (good && cur[id] == null) cur[id] = t;
      if (!good && cur[id] != null) { out[id].windows.push([+cur[id].toFixed(3), +t.toFixed(3)]); cur[id] = null; }
    }
  }
  for (const id of IDS) if (cur[id] != null) out[id].windows.push([+cur[id].toFixed(3), 60]);
  for (const id of IDS) {
    const w = out[id].windows.map(([a, b]) => b - a);
    out[id].longest = w.length ? +Math.max(...w).toFixed(3) : 0;
    out[id].text = (document.getElementById(id)?.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return out;
}, { IDS, step });
await browser.close(); srv.close();
fs.mkdirSync(path.join(PROMO, 'out'), { recursive: true });
fs.writeFileSync(path.join(PROMO, 'out', 'readcheck.json'), JSON.stringify(res, null, 1));
let fail = 0;
for (const [id, r] of Object.entries(res)) {
  const flag = r.longest >= 1.2 ? 'ok ' : 'LOW';
  if (r.longest < 1.2) fail++;
  console.log(`${flag} ${id.padEnd(7)} ${r.longest.toFixed(2).padStart(6)} s  ${JSON.stringify(r.windows.map((w) => w.map((x) => +x.toFixed(2))))}  ${r.text.slice(0, 48)}`);
}
console.log(fail ? `${fail} line(s) under 1.2 s` : 'all lines readable >= 1.2 s');
