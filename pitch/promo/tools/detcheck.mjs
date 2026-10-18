// Determinism probe: capture time T after different seek histories and report which pixels differ.
// Usage: node tools/detcheck.mjs <T[,T2,...]> [fromA fromB ...] [--hide sel1,sel2]
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
const args = process.argv.slice(2);
const hideIdx = args.indexOf('--hide');
const hide = hideIdx >= 0 ? args.splice(hideIdx, 2)[1].split(',') : [];
const TS = args[0].split(",").map(Number), froms = args.slice(1).map(Number);
const browser = await chromium.launch({ args: ['--force-device-scale-factor=1', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--run-all-compositor-stages-before-draw', '--disable-checker-imaging', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?render=1`);
await page.evaluate(() => window.__ready());
if (hide.length) await page.addStyleTag({ content: hide.map((h) => `${h}{display:none!important}`).join('\n') });
const cdp = await page.context().newCDPSession(page);
for (const T of TS) {
const shots = [];
for (const f of [T, ...froms]) {
  await page.evaluate(async ([a, b]) => { window.__seek(a); await new Promise((r) => requestAnimationFrame(r)); window.__seek(b); for (let k = 0; k < 2; k++) await new Promise((r) => requestAnimationFrame(r)); }, [f, T]);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 }, fromSurface: true });
  shots.push([f, data]);
}
const res = await page.evaluate(async (shots) => {
  const load = async (s) => createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
  const px = (im) => { const c = new OffscreenCanvas(im.width, im.height); const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
  const base = px(await load(shots[0][1]));
  const out = [];
  for (const [f, s] of shots.slice(1)) {
    const B = px(await load(s));
    let max = 0, n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const hist = {};
    for (let i = 0; i < base.length; i += 4) {
      const d = Math.max(Math.abs(base[i] - B[i]), Math.abs(base[i + 1] - B[i + 1]), Math.abs(base[i + 2] - B[i + 2]));
      if (d <= 4) continue;
      n++; if (d > max) max = d;
      const q = i >> 2, x = q % 1920, y = (q - x) / 1920;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const key = `${Math.floor(x / 120) * 120},${Math.floor(y / 120) * 120}`; hist[key] = (hist[key] || 0) + 1;
    }
    out.push({ from: f, max, n, bbox: n ? [x0, y0, x1, y1] : null, cells: Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8) });
  }
  return out;
}, shots);
console.log(JSON.stringify({ T, res }));
}
await browser.close(); srv.close();
