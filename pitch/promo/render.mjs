#!/usr/bin/env node
// MedX promo renderer.
// Serves the composition folder over a local HTTP server, drives headless Chromium via
// Playwright, waits for window.__ready(), then for every frame calls window.__seek(i / fps),
// lets the compositor settle for one animation frame, captures the 1920x1080 stage as JPEG and
// streams the frames, in order, to ffmpeg (image2pipe) -> H.264 High yuv420p BT.709 + AAC score.
//
//   node render.mjs                     full render -> out/medx-promo.mp4 + out/medx-promo-poster.jpg
//   node render.mjs --preview 4         every 4th frame, fast encode -> out/medx-promo-preview.mp4
//   node render.mjs --from 8 --to 12    one section -> out/medx-promo_8.000-12.000s.mp4
//   node render.mjs --frames-only       stills every --every s (default 1) + out/contact-sheet.jpg
//   node render.mjs --help              all flags
//
// Contract with the composition (index.html): window.__duration (s), window.__fps,
// async window.__ready(), window.__seek(t) (pure and deterministic), one 1920x1080 stage
// element (#stage, [data-stage] or .stage) rendered unscaled at the top-left of the viewport.
// The renderer sets window.__RENDER = true and loads the page with ?render=1.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const PROMO_DIR = path.dirname(fileURLToPath(import.meta.url));
// Repo copy (pitch/promo): packages resolve from pitch/promo/node_modules (npm --prefix pitch/promo install)
// unless MEDX_TOOLS names another folder whose node_modules has playwright.
const TOOLS_DIR = process.env.MEDX_TOOLS || PROMO_DIR;
const { chromium } = createRequire(path.join(TOOLS_DIR, 'package.json'))('playwright');
const DEFAULT_FFMPEG = 'C:\\Users\\User\\anaconda3\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const FFMPEG = process.env.MEDX_FFMPEG || (fs.existsSync(DEFAULT_FFMPEG) ? DEFAULT_FFMPEG : 'ffmpeg');
const W = 1920, H = 1080;
const FILM_SECONDS = 60; // contract length, used for the full-render projection
// encoder state shared by every encode: shot-change times (window.__keyframes) become forced IDR frames
const ENC = { keyframes: [] };

// ---------------------------------------------------------------- CLI
const HELP = `MedX promo renderer  (node render.mjs [flags])
 Preview
  --serve              only serve the folder for a browser preview (http://127.0.0.1:5179/index.html)
  --port <n>           port for --serve (default 5179)
 Range and mode
  --fps <n>            frames per second (default window.__fps, else 60)
  --from <s>           start time in seconds (default 0), snapped to the frame grid
  --to <s>             end time in seconds, exclusive (default window.__duration)
  --preview [N]        every Nth frame (default 4) at fps/N, fast encode -> out/medx-promo-preview.mp4
  --frames-only        no video: stills every --every s into out/frames + labelled out/contact-sheet.jpg
  --every <s>          contact-sheet interval (default 1)
  --times <a,b,...>    contact-sheet at exact times instead of --every
 Capture
  --workers <n>        parallel Chromium pages (default 4)
  --quality <q>        JPEG frame quality 1-100 (default 95)
  --png                lossless PNG frames instead of JPEG (slower)
  --cpu                software raster: bit-exact but about 9x slower (default GPU raster)
  --settle <n>         animation frames to wait after each seek before capture (default 2; 0 is unsafe)
  --channel <name>     Playwright Chromium channel, e.g. "chromium" for new headless (default headless shell)
 Encode
  --crf <n>            x264 CRF for the streamed encode (default 18; preview 24). Over --max-mb, a 2-pass encode hits the cap
  --preset <p>         x264 preset (default slow; preview veryfast)
  --max-mb <n>         size cap for the full render in MB (default 25); re-encodes from the master at a higher CRF
  --audio <file>       score, relative to --root (default audio/score.wav)
  --no-audio           silent AAC track instead of the score
  --audio-bitrate <b>  AAC bitrate (default 256k)
  --keep-master        keep the intermediate MJPEG master (out/.master.mjpeg) after a full render
  --no-hq-master       skip the high-bitrate master (out/medx-promo-master.mp4, CRF 14, AAC 320k) a full render writes
  --reencode           no capture: re-encode the kept master (with --crf / --preset / --audio)
 Files
  --out <file>         output file (default by mode, in --out-dir)
  --out-dir <dir>      output folder (default <promo>/out)
  --root <dir>         composition folder to serve (default the folder of render.mjs)
  --page <file>        page inside root (default index.html)
  --query <q>          extra query string for the page, e.g. "lang=th" (render=1 is always added)
  --stage <css>        stage selector (default #stage, [data-stage] or .stage)
  --poster-at <s>      poster time (default window.__posterTime, else duration - 2)
  --no-poster          skip the poster
 Checks
  --no-verify          skip the determinism self-check
  --no-qc              skip the frame QC gate (one-frame flash / black-frame detector, video mode)
  --qc-threshold <n>   mean |luma| step (0-255, 96x54 thumbnails) that makes a frame a flash candidate (default 12)
  --tolerance <n>      max per-channel difference (0-255) accepted as raster noise in that check (default 4)
  --lenient            downgrade contract-lint failures (running CSS animations, <video>, nondeterminism) to warnings
  --allow-console-errors  log page console errors instead of aborting
  --timeout <ms>       page load / __ready timeout (default 120000)
  --verbose            echo page console.log
 Env: MEDX_FFMPEG (ffmpeg path), MEDX_TOOLS (folder with node_modules/playwright), MEDX_CHROME_ARGS (extra Chromium flags).`;

const BOOL = new Set(['serve', 'frames-only', 'png', 'cpu', 'no-audio', 'no-poster', 'keep-master', 'no-hq-master', 'reencode', 'no-verify', 'no-qc', 'lenient',
  'allow-console-errors', 'verbose', 'help']);
const VALUE = new Set(['fps', 'from', 'to', 'preview', 'every', 'times', 'workers', 'quality', 'settle', 'channel', 'crf', 'preset',
  'max-mb', 'audio', 'audio-bitrate', 'out', 'out-dir', 'root', 'page', 'query', 'stage', 'poster-at', 'tolerance', 'timeout', 'port', 'qc-threshold']);

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], v;
    if (!a.startsWith('--')) throw new Error(`unexpected argument "${a}" (flags start with --; see --help)`);
    a = a.slice(2);
    const eq = a.indexOf('=');
    if (eq >= 0) { v = a.slice(eq + 1); a = a.slice(0, eq); }
    if (BOOL.has(a)) { o[a] = v === undefined ? true : !/^(0|false|no)$/i.test(v); continue; }
    if (!VALUE.has(a)) throw new Error(`unknown flag --${a} (see --help)`);
    if (v === undefined) {
      const nxt = argv[i + 1];
      if (a === 'preview' && (nxt === undefined || nxt.startsWith('--'))) { o.preview = '4'; continue; }
      if (nxt === undefined) throw new Error(`--${a} needs a value`);
      v = nxt; i++;
    }
    o[a] = v;
  }
  return o;
}

function num(v, name, { min = -Infinity, max = Infinity, int = false } = {}) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    throw new Error(`--${name} must be ${int ? 'an integer' : 'a number'} in [${min}, ${max}], got "${v}"`);
  }
  return n;
}

// ---------------------------------------------------------------- state, logging, abort
const state = { fatal: null, closing: false, warnings: [], aborters: new Set(), cleanup: new Set() };
const t0 = performance.now();
const stamp = () => `${((performance.now() - t0) / 1000).toFixed(1).padStart(6)}s`;
const log = (...m) => console.log(`[render ${stamp()}]`, ...m);
function warn(msg) { state.warnings.push(msg); console.warn(`[render ${stamp()}] WARN ${msg}`); }
function fail(err) {
  if (state.fatal || state.closing) return;
  state.fatal = err instanceof Error ? err : new Error(String(err));
  console.error(`[render ${stamp()}] FATAL ${state.fatal.message}`);
  for (const f of state.aborters) { try { f(); } catch { /* ignore */ } }
}
const checkFatal = () => { if (state.fatal) throw state.fatal; };
process.on('SIGINT', () => fail('interrupted (Ctrl+C)'));

// ---------------------------------------------------------------- static server
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

function startServer(mounts /* { '/': dir, '/__frames/': dir } */, port = 0) {
  const prefixes = Object.keys(mounts).sort((a, b) => b.length - a.length);
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(u.pathname);
      const prefix = prefixes.find((p) => rel.startsWith(p));
      const base = path.resolve(mounts[prefix]);
      rel = rel.slice(prefix.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const abs = path.resolve(base, rel);
      if (abs !== base && !abs.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
      const st = await fsp.stat(abs).catch(() => null);
      if (!st || !st.isFile()) {
        if (u.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
        res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found: ${u.pathname}`);
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
        'content-length': st.size, 'cache-control': 'no-store',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(abs).pipe(res);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end(String(e));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

// ---------------------------------------------------------------- page side
// Runs before any page script: seeded Math.random (identical in every page and every run)
// and a render flag the composition may use to hide preview-only UI.
const INIT_SCRIPT = `(() => {
  let s = 0x4d656458;
  Math.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__RENDER = true;
})();`;

// Evaluated in the page after __ready(): what the renderer needs, plus contract lint.
function pageLint({ stageSel, probeGpu }) {
  const sels = stageSel ? [stageSel] : ['#stage', '[data-stage]', '.stage'];
  let stage = null, usedSel = null;
  for (const s of sels) { stage = document.querySelector(s); if (stage) { usedSel = s; break; } }
  const r = stage ? stage.getBoundingClientRect() : { x: 0, y: 0, width: innerWidth, height: innerHeight };
  const imgs = [...document.images];
  const faces = [...document.fonts];
  const running = document.getAnimations().filter((a) => a.playState === 'running').map((a) => {
    const el = a.effect && a.effect.target;
    const who = el ? (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].join('.') : '')) : '?';
    return `${a.constructor.name}(${a.animationName || a.transitionProperty || a.id || ''}) on ${who}`;
  });
  let gpu = 'software raster (--cpu)';
  if (probeGpu) try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? 'webgl (renderer hidden)' : 'no webgl');
  } catch { /* ignore */ }
  return {
    duration: window.__duration, fps: window.__fps, posterTime: window.__posterTime,
    keyframes: Array.isArray(window.__keyframes) ? window.__keyframes.filter((v) => Number.isFinite(v)) : [],
    stage: { sel: usedSel, x: r.x, y: r.y, width: r.width, height: r.height },
    images: imgs.length,
    brokenImages: imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src || '(no src)'),
    fontFacesLoaded: faces.filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`),
    fontFacesError: faces.filter((f) => f.status === 'error').map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`),
    runningAnimations: running,
    videos: document.querySelectorAll('video').length,
    gpu,
  };
}

function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${what} timed out after ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

async function openWorker(browser, idx, url, opts) {
  const context = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference',
  });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  const tag = `page${idx}`;
  const problem = (msg) => (opts.allowConsoleErrors ? warn(`${tag} ${msg}`) : fail(`${tag} ${msg}`));
  page.on('console', (m) => {
    const type = m.type();
    if (type === 'error') problem(`console.error: ${m.text()}`);
    else if (type === 'warning') { if (idx === 0) warn(`page console.warn: ${m.text()}`); }
    else if (opts.verbose && idx === 0) log(`page console.${type}: ${m.text()}`);
  });
  page.on('pageerror', (e) => fail(`${tag} uncaught page error: ${e.message}`));
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText || '';
    // Chromium cancels media range requests itself (e.g. a preview-only <audio>); not an asset error.
    if (r.resourceType() === 'media' && /ERR_ABORTED/.test(why)) { if (opts.verbose) log(`${tag} media request cancelled: ${r.url()}`); return; }
    fail(`${tag} request failed: ${r.url()} (${why})`);
  });
  page.on('response', (r) => { if (r.status() >= 400) fail(`${tag} HTTP ${r.status()} for ${r.url()}`); });
  page.on('crash', () => fail(`${tag} renderer crashed (out of memory or GPU lost? retry with fewer --workers or --cpu)`));
  await page.goto(url, { waitUntil: 'load', timeout: opts.timeout });
  await page.waitForFunction(() => typeof window.__seek === 'function' && typeof window.__ready === 'function', null, { timeout: opts.timeout })
    .catch(() => { throw new Error(`${tag}: page never defined window.__seek and window.__ready (is ${url} the composition?)`); });
  await withTimeout(page.evaluate(async () => { await window.__ready(); await document.fonts.ready; }), opts.timeout, `${tag} window.__ready()`);
  const lint = await page.evaluate(pageLint, { stageSel: opts.stage || null, probeGpu: !opts.cpu });
  const cdp = await context.newCDPSession(page);
  return { idx, context, page, cdp, lint };
}

// One frame: pure seek, let the compositor produce a frame (settle), then capture the stage.
// Without the settle, Page.captureScreenshot can return tiles from before the seek (measured).
async function capture(w, t, opts, override = {}) {
  const a = performance.now();
  await w.page.evaluate(async ([tt, settle]) => {
    await window.__seek(tt);
    for (let k = 0; k < settle; k++) await new Promise((r) => requestAnimationFrame(r));
  }, [t, opts.settle]);
  const b = performance.now();
  const format = override.format || opts.format;
  const params = { format, clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, captureBeyondViewport: false, fromSurface: true, optimizeForSpeed: true };
  if (format === 'jpeg') params.quality = override.quality || opts.quality;
  const { data } = await w.cdp.send('Page.captureScreenshot', params);
  const c = performance.now();
  return { buf: Buffer.from(data, 'base64'), seekMs: b - a, capMs: c - b };
}

const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

// Pixel diff of two PNGs, computed in a scratch page (no image libraries needed in Node).
async function makeDiffer(browser) {
  const ctx = await browser.newContext({ viewport: { width: 64, height: 64 } });
  const p = await ctx.newPage();
  await p.setContent('<!doctype html><title>diff</title>');
  return {
    diff: (a, b) => p.evaluate(async ([a64, b64]) => {
      const load = async (s) => createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
      const px = (im) => {
        const c = new OffscreenCanvas(im.width, im.height);
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0);
        return g.getImageData(0, 0, im.width, im.height).data;
      };
      const [ia, ib] = await Promise.all([load(a64), load(b64)]);
      const A = px(ia), B = px(ib), w = ia.width;
      let max = 0, n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let i = 0; i < A.length; i += 4) {
        const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        if (!d) continue;
        n++; if (d > max) max = d;
        const q = i >> 2, x = q % w, y = (q - x) / w;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return { max, n, bbox: n ? [x0, y0, x1, y1] : null };
    }, [a.toString('base64'), b.toString('base64')]),
    close: () => ctx.close(),
  };
}

// Seeks forwards, backwards and in another order on a second page (PNG, lossless). Bit-exact or
// within raster noise (GPU anti-aliasing, <= tolerance) proves __seek is pure and no capture is stale.
async function verifyDeterminism(browser, workers, frameTimes, opts) {
  const A = workers[0], B = workers[workers.length - 1];
  const png = { format: 'png' };
  const pass = async (w, times) => { const m = new Map(); for (const t of times) m.set(t, (await capture(w, t, opts, png)).buf); return m; };
  const fwd = await pass(A, frameTimes);
  const rev = await pass(A, [...frameTimes].reverse());
  const rotated = frameTimes.map((_, k) => frameTimes[(k + Math.ceil(frameTimes.length / 2)) % frameTimes.length]);
  const oth = B !== A ? await pass(B, rotated) : rev;
  const differ = await makeDiffer(browser);
  const rows = [];
  try {
    for (const t of frameTimes) {
      let worst = { max: 0, n: 0, bbox: null };
      for (const other of [rev.get(t), oth.get(t)]) {
        if (sha1(other) === sha1(fwd.get(t))) continue;
        const d = await differ.diff(fwd.get(t), other);
        if (d.max > worst.max || (d.max === worst.max && d.n > worst.n)) worst = d;
      }
      rows.push({ t, ...worst });
    }
  } finally { await differ.close(); }
  return {
    exact: rows.filter((r) => r.max === 0).length,
    noise: rows.filter((r) => r.max > 0 && r.max <= opts.tolerance),
    bad: rows.filter((r) => r.max > opts.tolerance),
  };
}

// ---------------------------------------------------------------- ffmpeg
function startFfmpeg(args, label) {
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  let stderr = '', ending = false;
  ff.stderr.on('data', (d) => { stderr = (stderr + d).slice(-20000); });
  const exited = new Promise((res) => ff.on('close', (code, signal) => res({ code, signal })));
  ff.on('error', (e) => fail(`${label}: could not start ffmpeg (${FFMPEG}): ${e.message}`));
  ff.stdin.on('error', (e) => { if (!ending) fail(`${label}: ffmpeg stdin ${e.code || e.message}\n${stderr.slice(-2000)}`); });
  exited.then(({ code }) => { if (!ending && code !== 0) fail(`${label}: ffmpeg exited early (code ${code})\n${stderr.slice(-3000)}`); });
  const abort = () => { ending = true; try { ff.kill('SIGKILL'); } catch { /* ignore */ } };
  state.aborters.add(abort);
  return {
    async write(buf) {
      if (!ff.stdin.write(buf)) await Promise.race([once(ff.stdin, 'drain'), exited]);
    },
    async end() {
      ending = true;
      ff.stdin.end();
      const r = await exited;
      state.aborters.delete(abort);
      if (r.code !== 0) throw new Error(`${label}: ffmpeg exited with code ${r.code}\n${stderr.slice(-3000)}`);
      return stderr;
    },
  };
}

function runFfmpeg(args, label) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out = [], err = [];
    ff.stdout.on('data', (d) => out.push(d));
    ff.stderr.on('data', (d) => err.push(d));
    ff.on('error', reject);
    ff.on('close', (code) => {
      const stderr = Buffer.concat(err).toString();
      if (code !== 0) reject(new Error(`${label}: ffmpeg exited with code ${code}\n${stderr.slice(-3000)}`));
      else resolve({ stdout: Buffer.concat(out), stderr });
    });
  });
}

const evalRate = (r) => { const [n, d = '1'] = String(r).split('/'); return Number(n) / Number(d); };

// Chromium JPEGs are full-range BT.601 YCbCr. Convert explicitly to limited-range BT.709 and tag
// the stream, so brand colours (#0A8077, #1A5FC4) decode to the same RGB in players.
// Rate control: CRF by default; with `bitrate` a 2-pass ABR (pass 1 writes only the x264 stats).
// GOP: a keyframe at least every 2 s, scene-cut detection on, and an IDR forced on every shot change the
// composition lists in window.__keyframes, so no cut lands one frame after a GOP boundary. aq-mode 3 biases bits
// towards dark flat areas (the ink gradients), -tune film keeps grain and fine detail.
function encodeArgs({ input, inputCodec, rate, audio, startSec, durSec, crf, preset, audioBitrate, out, bitrate, pass, passlog, tune = 'film' }) {
  const a = ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', rate, '-c:v', inputCodec, '-i', input];
  if (audio) {
    if (startSec > 0) a.push('-ss', startSec.toFixed(6));
    a.push('-t', durSec.toFixed(6), '-i', audio);
  } else {
    a.push('-f', 'lavfi', '-t', durSec.toFixed(6), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  }
  const scale = inputCodec === 'png'
    ? 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int'
    : 'scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int';
  const fpsN = evalRate(rate);
  const half = 0.5 / fpsN;
  const kf = (ENC.keyframes || []).map((t) => t - startSec).filter((t) => t > half && t < durSec - half).map((t) => t.toFixed(4));
  const rc = bitrate
    ? ['-b:v', bitrate, '-maxrate', Math.round(parseFloat(bitrate) * 3) + 'k', '-bufsize', Math.round(parseFloat(bitrate) * 6) + 'k']
    : ['-crf', String(crf)];
  a.push('-map', '0:v:0');
  if (pass !== 1) a.push('-map', '1:a:0');
  a.push('-vf', `${scale},format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709`,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', preset, ...(tune ? ['-tune', tune] : []), ...rc,
    ...(pass ? ['-pass', String(pass), '-passlogfile', passlog] : []),
    '-x264-params', `keyint=${Math.max(1, Math.round(2 * fpsN))}:min-keyint=1:scenecut=40:aq-mode=3`,
    ...(kf.length ? ['-force_key_frames', kf.join(',')] : []),
    '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-r', rate);
  if (pass === 1) a.push('-an', '-t', durSec.toFixed(6), '-f', 'null', '-');
  else a.push('-af', 'apad', '-c:a', 'aac', '-b:a', audioBitrate, '-ar', '48000', '-ac', '2',
    '-t', durSec.toFixed(6), '-movflags', '+faststart', out);
  return a;
}

// 2-pass ABR from the master, sized to land just under the cap (video kbps = (target bits - audio bits) / duration)
async function twoPass({ masterFile, inputCodec, rate, audio, startSec, durSec, preset, audioBitrate, out, targetBytes, outDir }) {
  const aBits = parseFloat(audioBitrate) * 1000 * durSec;
  const kbps = Math.max(300, Math.floor(((targetBytes * 8 - aBits) / durSec) * 0.985 / 1000));
  const passlog = path.join(outDir, '.x264pass');
  const base = { input: masterFile, inputCodec, rate, audio, startSec, durSec, preset, audioBitrate, bitrate: kbps + 'k', passlog };
  try {
    await runFfmpeg(encodeArgs({ ...base, pass: 1, out: '-' }), '2-pass (1/2)');
    await runFfmpeg(encodeArgs({ ...base, pass: 2, out }), '2-pass (2/2)');
  } finally {
    for (const f of await fsp.readdir(outDir)) if (f.startsWith('.x264pass')) await fsp.rm(path.join(outDir, f), { force: true });
  }
  return kbps;
}

async function probe(file) {
  const { stderr } = await runFfmpeg(['-hide_banner', '-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'], 'probe');
  const frames = [...stderr.matchAll(/frame=\s*(\d+)/g)].pop();
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr);
  const v = /Stream #\S+.*Video: (.+)/.exec(stderr);
  const au = /Stream #\S+.*Audio: (.+)/.exec(stderr);
  return {
    frames: frames ? Number(frames[1]) : null,
    duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
    video: v ? v[1].trim() : null,
    audio: au ? au[1].trim() : null,
  };
}

function readWavInfo(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(4096);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') return null;
    let off = 12, fmt = null;
    while (off + 8 <= n) {
      const id = head.toString('ascii', off, off + 4), size = head.readUInt32LE(off + 4);
      if (id === 'fmt ') fmt = { channels: head.readUInt16LE(off + 10), rate: head.readUInt32LE(off + 12), byteRate: head.readUInt32LE(off + 16) };
      if (id === 'data' && fmt) {
        const dataSize = Math.min(size, fs.fstatSync(fd).size - off - 8);
        return { ...fmt, seconds: dataSize / fmt.byteRate };
      }
      off += 8 + size + (size & 1);
    }
    return fmt ? { ...fmt, seconds: null } : null;
  } finally { fs.closeSync(fd); }
}


// ---------------------------------------------------------------- frame QC gate
// A compositor hiccup can return one partly painted frame (for example black except one layer).
// After the capture, every frame of the master is decoded to a 96x54 luma thumbnail. A frame is a
// flash candidate when it differs from BOTH neighbours by more than --qc-threshold while the two
// neighbours agree with each other (also checked for a two-frame pair). Each candidate is captured
// again (up to 3 times, with a longer settle). If the new capture fits its neighbours it replaces the
// frame and the film is re-encoded from the patched master. A candidate that stays a flash fails the
// render when it meets the hard rule (step > 20 to both neighbours, neighbours within 2) or when its
// re-captures differ from each other; otherwise it is kept with a warning (a real transient).
const QW = 96, QH = 54, QN = QW * QH;
function thumbArgs(inputCodec, input) {
  return ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', inputCodec, '-i', input,
    '-vf', `scale=${QW}:${QH}:flags=area,format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'];
}
async function decodeThumbs(file, inputCodec, frames) {
  const { stdout } = await runFfmpeg(thumbArgs(inputCodec, file), 'qc decode');
  if (stdout.length !== frames * QN) throw new Error(`qc: decoded ${stdout.length / QN} thumbnails, expected ${frames}`);
  return stdout;
}
function thumbOf(buf, inputCodec) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, thumbArgs(inputCodec, 'pipe:0'), { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const out = [], err = [];
    ff.stdout.on('data', (d) => out.push(d));
    ff.stderr.on('data', (d) => err.push(d));
    ff.on('error', reject);
    ff.on('close', (code) => {
      const b = Buffer.concat(out);
      if (code !== 0 || b.length !== QN) reject(new Error(`qc thumbnail: ffmpeg code ${code}, ${b.length} bytes\n${Buffer.concat(err).toString().slice(-1500)}`));
      else resolve(b);
    });
    ff.stdin.end(buf);
  });
}
const lumaDiff = (a, b) => { let s = 0; for (let k = 0; k < QN; k++) s += Math.abs(a[k] - b[k]); return s / QN; };

async function qcGate({ masterFile, inputCodec, jobs, worker, opts, threshold }) {
  const n = jobs.length;
  const report = { checked: n, threshold, candidates: [], replaced: [], transients: [] };
  if (n < 3) return { report, replacements: new Map() };
  const all = await decodeThumbs(masterFile, inputCodec, n);
  const T = (i) => all.subarray(i * QN, (i + 1) * QN);
  const LO = threshold;
  const cands = [];
  const taken = new Set();
  for (let i = 1; i < n - 1; i++) {
    const dP = lumaDiff(T(i), T(i - 1)), dN = lumaDiff(T(i), T(i + 1));
    if (dP <= LO || dN <= LO) continue;
    const dPN = lumaDiff(T(i - 1), T(i + 1));
    if (dPN < Math.max(2, 0.35 * Math.min(dP, dN))) { cands.push({ frames: [i], prev: i - 1, next: i + 1, dP, dN, dPN }); taken.add(i); }
  }
  for (let i = 1; i < n - 2; i++) {
    if (taken.has(i) || taken.has(i + 1)) continue;
    const dP = lumaDiff(T(i), T(i - 1)), dN = lumaDiff(T(i + 1), T(i + 2));
    if (dP <= LO || dN <= LO) continue;
    const dPN = lumaDiff(T(i - 1), T(i + 2));
    if (dPN < Math.max(2, 0.35 * Math.min(dP, dN))) { cands.push({ frames: [i, i + 1], prev: i - 1, next: i + 2, dP, dN, dPN }); taken.add(i); taken.add(i + 1); }
  }
  const replacements = new Map();
  for (const c of cands) {
    const row = { frames: c.frames.map((i) => jobs[i].i), t: +jobs[c.frames[0]].t.toFixed(4), dPrev: +c.dP.toFixed(2), dNext: +c.dN.toFixed(2), dNeighbours: +c.dPN.toFixed(2), attempts: 0, fixed: false };
    report.candidates.push(row);
    log(`qc: flash candidate at frame ${row.frames.join('+')} (${row.t} s): step ${row.dPrev} / ${row.dNext}, neighbours ${row.dNeighbours}`);
    let allFixed = true, unstable = false;
    for (const i of c.frames) {
      let ok = false;
      for (let a = 0; a < 3 && !ok; a++) {
        row.attempts++;
        const { buf } = await capture(worker, jobs[i].t, { ...opts, settle: opts.settle + 2 + a });
        const th = await thumbOf(buf, inputCodec);
        const dP = lumaDiff(th, T(c.prev)), dN = lumaDiff(th, T(c.next));
        if (!(dP > LO && dN > LO)) { replacements.set(i, buf); ok = true; }
        else if (lumaDiff(th, T(i)) > 1) unstable = true;
      }
      if (!ok) allFixed = false;
    }
    row.fixed = allFixed;
    if (allFixed) { report.replaced.push(...row.frames); continue; }
    for (const i of c.frames) replacements.delete(i);
    const hard = c.dP > 20 && c.dN > 20 && c.dPN < 2;
    if (hard || unstable) {
      throw new Error(`qc: frame ${row.frames.join('+')} (${row.t} s) is a ${unstable ? 'non-deterministic ' : ''}flash `
        + `(luma step ${row.dPrev} / ${row.dNext} to its neighbours, neighbours ${row.dNeighbours}) and 3 re-captures did not fix it`);
    }
    report.transients.push(row.frames);
    warn(`qc: frame ${row.frames.join('+')} (${row.t} s) is a deterministic one-frame transient in the composition (step ${row.dPrev} / ${row.dNext}); kept`);
  }
  return { report, replacements };
}

// Rewrites the concatenated-frame master with the replaced frames (streamed, not loaded in memory).
async function patchMaster(masterFile, frameSizes, replacements) {
  const tmp = masterFile + '.qc';
  const src = await fsp.open(masterFile, 'r');
  const dst = fs.createWriteStream(tmp);
  try {
    let pos = 0;
    for (let i = 0; i < frameSizes.length; i++) {
      const size = frameSizes[i];
      let chunk = replacements.get(i);
      if (!chunk) {
        chunk = Buffer.allocUnsafe(size);
        const { bytesRead } = await src.read(chunk, 0, size, pos);
        if (bytesRead !== size) throw new Error(`qc: short read in master at frame ${i}`);
      }
      pos += size;
      if (!dst.write(chunk)) await once(dst, 'drain');
    }
  } finally {
    await src.close();
    dst.end();
    await once(dst, 'close');
  }
  await fsp.rename(tmp, masterFile);
}

// ---------------------------------------------------------------- frame pool
// Pages pull frame jobs from a shared counter; finished frames reach onFrame strictly in order.
// Back-pressure keeps at most maxAhead encoded frames in memory.
async function runPool(workers, jobs, opts, onFrame) {
  let next = 0, written = 0, lastLog = performance.now();
  const done = new Map();
  const maxAhead = Math.max(8, workers.length * 3);
  let waiters = [];
  const wake = () => { const ws = waiters; waiters = []; ws.forEach((r) => r()); };
  state.aborters.add(wake);
  const stats = { seekMs: 0, capMs: 0, n: 0, started: performance.now() };
  let chain = Promise.resolve();
  const progress = (force) => {
    const now = performance.now();
    if (!force && now - lastLog < 2000) return;
    lastLog = now;
    const el = (now - stats.started) / 1000;
    const msPerFrame = (el * 1000) / Math.max(1, written);
    const eta = ((jobs.length - written) * msPerFrame) / 1000;
    log(`frame ${written}/${jobs.length} (${((100 * written) / jobs.length).toFixed(1)}%)  ${msPerFrame.toFixed(1)} ms/frame  `
      + `[per page: seek+settle ${(stats.seekMs / Math.max(1, stats.n)).toFixed(1)} ms, capture ${(stats.capMs / Math.max(1, stats.n)).toFixed(1)} ms]  ETA ${eta.toFixed(0)} s`);
  };
  const flush = async () => {
    while (!state.fatal && done.has(written)) {
      const buf = done.get(written);
      done.delete(written);
      await onFrame(jobs[written], buf, written);
      written++;
      wake();
      progress(false);
    }
  };
  const worker = async (w) => {
    while (!state.fatal && next < jobs.length) {
      while (!state.fatal && next - written >= maxAhead) await new Promise((r) => waiters.push(r));
      if (state.fatal || next >= jobs.length) break;
      const k = next++;
      const r = await capture(w, jobs[k].t, opts).catch((e) => { fail(`page${w.idx} frame ${jobs[k].i} @ ${jobs[k].t.toFixed(4)} s: ${e.message}`); return null; });
      if (!r) break;
      stats.seekMs += r.seekMs; stats.capMs += r.capMs; stats.n++;
      done.set(k, r.buf);
      chain = chain.then(flush).catch((e) => fail(e));
    }
  };
  await Promise.all(workers.map(worker));
  await chain;
  state.aborters.delete(wake);
  checkFatal();
  if (written !== jobs.length) throw new Error(`internal: wrote ${written} of ${jobs.length} frames`);
  progress(true);
  const wallMs = performance.now() - stats.started;
  return { wallMs, msPerFrame: wallMs / jobs.length, seekMsAvg: stats.seekMs / stats.n, capMsAvg: stats.capMs / stats.n };
}

// ---------------------------------------------------------------- contact sheet
async function contactSheet(browser, origin, items, outPath) {
  const cols = 6, tw = 300, th = 169;
  const cells = items.map((f) => `<figure><img src="${origin}/__frames/${encodeURIComponent(f.file)}"><figcaption>${f.t.toFixed(2)} s &middot; frame ${f.i}</figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:#0F1E2E}
    body{padding:20px;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:14px 12px;width:max-content;
         font:600 13px/1.3 "Segoe UI",system-ui,sans-serif;color:#EEF3F6}
    figure{margin:0} img{display:block;width:${tw}px;height:${th}px;border-radius:4px;background:#173A63}
    figcaption{margin-top:5px;opacity:.75;font-variant-numeric:tabular-nums}</style>${cells}`;
  const ctx = await browser.newContext({ viewport: { width: cols * (tw + 12) + 40, height: 300 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await p.screenshot({ path: outPath, type: 'jpeg', quality: 85, fullPage: true });
  await ctx.close();
}

// ---------------------------------------------------------------- main
const fmtS = (s) => s.toFixed(3);
const mb = (b) => b / 1e6;
const round = (p) => ({ wallSec: +(p.wallMs / 1000).toFixed(2), msPerFrame: +p.msPerFrame.toFixed(2), seekMsAvg: +p.seekMsAvg.toFixed(2), captureMsAvg: +p.capMsAvg.toFixed(2) });

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }

  const root = path.resolve(PROMO_DIR, args.root || '.');
  const pageFile = args.page || 'index.html';
  const outDir = path.resolve(PROMO_DIR, args['out-dir'] || 'out');
  const preview = args.preview !== undefined ? num(args.preview, 'preview', { min: 1, int: true }) : 0;
  const mode = args['frames-only'] ? 'frames' : preview ? 'preview' : 'video';
  const opts = {
    workers: num(args.workers, 'workers', { min: 1, max: 16, int: true }) ?? 4,
    quality: num(args.quality, 'quality', { min: 1, max: 100, int: true }) ?? 95,
    format: args.png ? 'png' : 'jpeg',
    settle: num(args.settle, 'settle', { min: 0, max: 10, int: true }) ?? 2,
    tolerance: num(args.tolerance, 'tolerance', { min: 0, max: 255, int: true }) ?? 4,
    stage: args.stage,
    timeout: num(args.timeout, 'timeout', { min: 1000 }) ?? 120000,
    allowConsoleErrors: !!args['allow-console-errors'],
    verbose: !!args.verbose,
    cpu: !!args.cpu,
  };
  if (opts.settle === 0) warn('--settle 0: captures may show tiles from before the seek');
  const crf = num(args.crf, 'crf', { min: 0, max: 51 }) ?? (mode === 'preview' ? 24 : 18);
  const preset = args.preset || (mode === 'preview' ? 'veryfast' : 'slow');
  const maxBytes = (num(args['max-mb'], 'max-mb', { min: 0.01 }) ?? 25) * 1e6;
  const audioBitrate = args['audio-bitrate'] || '256k';
  await fsp.mkdir(outDir, { recursive: true });

  if (args.reencode) return reencodeOnly({ args, root, outDir, crf, preset, audioBitrate, maxBytes });

  const pageUrlPath = '/' + pageFile.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!fs.existsSync(path.join(root, pageFile))) throw new Error(`composition not found: ${path.join(root, pageFile)}`);
  if (args.serve) {
    const { origin } = await startServer({ '/': root }, num(args.port, 'port', { min: 1, max: 65535, int: true }) ?? 5179);
    log(`serving ${root} for browser preview (Ctrl+C to stop):`);
    for (const f of [pageFile, 'preview.html']) if (fs.existsSync(path.join(root, f))) log(`  ${origin}/${f.replace(/\\/g, '/')}`);
    await new Promise(() => {}); // until Ctrl+C
  }
  const framesDir = path.join(outDir, 'frames');
  const { server, origin } = await startServer({ '/': root, '/__frames/': framesDir });
  state.aborters.add(() => server.close());
  // --run-all-compositor-stages-before-draw: a drawn frame always has every tile rastered.
  // --disable-checker-imaging: images are never drawn as placeholders while they decode.
  const launchArgs = ['--hide-scrollbars', '--force-device-scale-factor=1', '--force-color-profile=srgb', '--font-render-hinting=none',
    '--disable-lcd-text', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--mute-audio', '--run-all-compositor-stages-before-draw', '--disable-checker-imaging'];
  if (args.cpu) launchArgs.push('--disable-gpu');
  else launchArgs.push('--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11');
  if (process.env.MEDX_CHROME_ARGS) launchArgs.push(...process.env.MEDX_CHROME_ARGS.split(/\s+/).filter(Boolean));
  const browser = await chromium.launch({ headless: true, args: launchArgs, ...(args.channel ? { channel: args.channel } : {}) });
  state.aborters.add(() => { browser.close().catch(() => {}); });
  log(`chromium ${browser.version()} (${args.cpu ? 'software raster' : 'GPU raster'})  serving ${root} at ${origin}`);

  let partialOut = null, ok = false;
  try {
    const query = new URLSearchParams(args.query || '');
    query.set('render', '1');
    const url = `${origin}${pageUrlPath}?${query}`;
    const t1 = performance.now();
    // open one page first (fast failure on a broken page), then the rest in parallel
    const workers = [await openWorker(browser, 0, url, opts)];
    checkFatal();
    workers.push(...await Promise.all(Array.from({ length: opts.workers - 1 }, (_, k) => openWorker(browser, k + 1, url, opts))));
    checkFatal();
    const L = workers[0].lint;
    ENC.keyframes = L.keyframes || [];

    // ---- contract checks
    if (!(Number.isFinite(L.duration) && L.duration > 0)) throw new Error(`window.__duration must be a positive number, got ${L.duration}`);
    const fps = num(args.fps, 'fps', { min: 1, max: 240 }) ?? (Number.isFinite(L.fps) && L.fps > 0 ? L.fps : 60);
    const s = L.stage;
    if (!s.sel) warn(`no stage element found (#stage, [data-stage], .stage); capturing the whole ${W}x${H} viewport`);
    if (Math.abs(s.x) > 0.5 || Math.abs(s.y) > 0.5 || Math.abs(s.width - W) > 0.5 || Math.abs(s.height - H) > 0.5) {
      throw new Error(`stage ${s.sel} is ${s.width}x${s.height} at (${s.x}, ${s.y}); it must render unscaled at ${W}x${H} at (0, 0) when window.__RENDER is true / ?render=1 (disable any fit-to-window scaling in render mode)`);
    }
    if (L.brokenImages.length) throw new Error(`images not loaded after __ready(): ${L.brokenImages.join(', ')}`);
    if (L.fontFacesError.length) throw new Error(`font faces failed to load: ${L.fontFacesError.join(', ')}`);
    const lintFail = (m) => (args.lenient ? warn(m) : fail(m));
    if (L.videos) lintFail(`contract: ${L.videos} <video> element(s) found; video must be deterministic (no <video>)`);
    if (L.runningAnimations.length) lintFail(`contract: real-time CSS/Web animations running: ${L.runningAnimations.slice(0, 8).join('; ')}`);
    checkFatal();
    if (Math.abs(L.duration - FILM_SECONDS) > 1e-9) warn(`window.__duration is ${L.duration}, not ${FILM_SECONDS} (fine for a test composition)`);
    if (!args.cpu && /swiftshader|software/i.test(L.gpu)) warn(`GPU raster requested but Chromium reports "${L.gpu}" (slow software path)`);

    // ---- frame range
    const totalFrames = Math.round(L.duration * fps);
    const f0 = args.from !== undefined ? Math.round(num(args.from, 'from', { min: 0 }) * fps) : 0;
    const f1 = Math.min(totalFrames, args.to !== undefined ? Math.round(num(args.to, 'to', { min: 0 }) * fps) : totalFrames);
    if (f1 <= f0) throw new Error(`empty range: frames ${f0}..${f1} (from ${args.from ?? 0} to ${args.to ?? L.duration} at ${fps} fps)`);
    const full = f0 === 0 && f1 === totalFrames;
    const startSec = f0 / fps, endSec = f1 / fps, durSec = (f1 - f0) / fps;

    // ---- warm-up: first captures after load can differ (GPU uploads); render a few and discard
    await Promise.all(workers.map(async (w) => { for (const i of [f0, Math.floor((f0 + f1) / 2), f1 - 1, f0]) await capture(w, i / fps, opts); }));
    const startupMs = performance.now() - t1;
    log(`ready: ${workers.length} pages in ${(startupMs / 1000).toFixed(1)} s | duration ${L.duration} s, ${fps} fps${args.fps ? ' (--fps)' : ''} | `
      + `stage ${s.sel || 'viewport'} | ${L.images} <img> | ${L.fontFacesLoaded.length} font faces `
      + `[${[...new Set(L.fontFacesLoaded.map((f) => f.replace(/ \d+$/, '')))].join(', ') || 'none'}] | ${L.gpu}`);

    // ---- determinism self-check
    let determinism = 'skipped';
    if (!args['no-verify']) {
      const span = f1 - f0;
      const pick = [...new Set([f0, f0 + Math.floor(span * 0.37), f0 + Math.floor(span * 0.71), f1 - 1])].map((i) => i / fps);
      const v = await verifyDeterminism(browser, workers, pick, opts);
      const noise = v.noise.length ? `, ${v.noise.length} within raster noise (max ${Math.max(...v.noise.map((r) => r.max))}/255)` : '';
      if (v.bad.length) {
        determinism = 'FAILED';
        lintFail(`determinism: ${v.bad.map((r) => `${r.t.toFixed(3)} s (max diff ${r.max}/255 over ${r.n} px, box x${r.bbox[0]}-${r.bbox[2]} y${r.bbox[1]}-${r.bbox[3]})`).join('; ')} `
          + 'differ between seek orders or pages. Something animates outside the paused GSAP master timeline '
          + '(CSS transition/animation, rAF loop, Date.now, randomness inside __seek, an image still decoding).');
      } else {
        determinism = `ok: ${v.exact} bit-exact${noise}`;
        log(`determinism ${determinism} of ${pick.length} sampled frames (forwards, backwards, second page)`);
      }
      checkFatal();
      const after = await workers[0].page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
      if (after) lintFail(`contract: ${after} CSS/Web animation(s) start running after seeking (CSS transitions?); frames would depend on wall-clock time`);
      checkFatal();
    }

    // ---- frames-only: stills + contact sheet
    if (mode === 'frames') {
      let times;
      if (args.times) times = String(args.times).split(',').map((x) => num(x.trim(), 'times', { min: 0 }));
      else {
        const every = num(args.every, 'every', { min: 1 / fps }) ?? 1;
        times = [];
        for (let k = 0; ; k++) { const t = startSec + k * every; if (t >= endSec - 1e-9) break; times.push(t); }
      }
      const seen = new Set();
      const jobs = times.map((t) => Math.min(totalFrames - 1, Math.round(t * fps))).filter((i) => !seen.has(i) && seen.add(i)).map((i) => ({ i, t: i / fps }));
      await fsp.rm(framesDir, { recursive: true, force: true });
      await fsp.mkdir(framesDir, { recursive: true });
      const items = [];
      const ext = opts.format === 'png' ? 'png' : 'jpg';
      const perf = await runPool(workers, jobs, opts, async (job, buf) => {
        const file = `t_${fmtS(job.t).padStart(7, '0')}_f${String(job.i).padStart(5, '0')}.${ext}`;
        await fsp.writeFile(path.join(framesDir, file), buf);
        items.push({ ...job, file });
      });
      const sheet = path.join(outDir, 'contact-sheet.jpg');
      await contactSheet(browser, origin, items, sheet);
      await finish({ ok: true, mode, fps, frames: jobs.length, framesDir, contactSheet: sheet, workers: workers.length,
        raster: args.cpu ? 'cpu' : 'gpu', gpu: L.gpu, determinism, ...round(perf), warnings: state.warnings }, outDir);
      ok = true;
      return;
    }

    // ---- audio
    let audio = null;
    const audioPath = path.resolve(root, args.audio || path.join('audio', 'score.wav'));
    if (!args['no-audio']) {
      if (fs.existsSync(audioPath)) {
        audio = audioPath;
        const wi = readWavInfo(audioPath);
        if (wi) {
          if (wi.rate !== 48000 || wi.channels !== 2) warn(`score is ${wi.rate} Hz / ${wi.channels} ch; expected 48000 Hz stereo (ffmpeg resamples)`);
          if (wi.seconds != null && Math.abs(wi.seconds - L.duration) > 0.5 / fps) warn(`score is ${wi.seconds.toFixed(3)} s, composition is ${L.duration} s; audio is padded/trimmed to the video`);
        } else warn(`could not read ${audioPath} as WAV; passing it to ffmpeg as is`);
      } else if (full && mode === 'video') {
        throw new Error(`score not found: ${audioPath} (a full render needs the score; pass --no-audio for a silent track)`);
      } else warn(`score not found (${audioPath}); using a silent track`);
    }

    // ---- outputs
    const range = full ? '' : `_${fmtS(startSec)}-${fmtS(endSec)}s`;
    const outFile = path.resolve(PROMO_DIR, args.out || path.join(outDir, mode === 'preview' ? `medx-promo-preview${range}.mp4` : `medx-promo${range}.mp4`));
    const posterFile = path.join(path.dirname(outFile), path.basename(outFile, '.mp4') + '-poster.jpg');
    const jobs = [];
    for (let i = f0; i < f1; i += preview || 1) jobs.push({ i, t: i / fps });
    const rate = preview ? `${fps}/${preview}` : String(fps);
    const inputCodec = opts.format === 'png' ? 'png' : 'mjpeg';
    const wantMaster = mode === 'video';
    const masterBase = path.join(outDir, `.master${range}`);
    const masterFile = masterBase + (opts.format === 'png' ? '.pngs' : '.mjpeg');
    const masterStream = wantMaster ? fs.createWriteStream(masterFile) : null;
    if (masterStream) state.cleanup.add(masterFile);
    const tmpOut = outFile.replace(/\.mp4$/i, '') + '.partial.mp4';
    partialOut = tmpOut;

    log(`${mode}: frames ${f0}..${f1 - 1}${preview ? ` every ${preview}` : ''} (${jobs.length} frames, ${fmtS(startSec)}-${fmtS(endSec)} s) at ${rate} fps | `
      + `${opts.format}${opts.format === 'jpeg' ? ` q${opts.quality}` : ''} | x264 ${preset} crf ${crf} | audio ${audio ? path.basename(audio) : 'silent'}`);
    const ff = startFfmpeg(encodeArgs({ input: 'pipe:0', inputCodec, rate, audio, startSec, durSec, crf, preset, audioBitrate, out: tmpOut }), 'encode');
    const frameSizes = [];
    const perf = await runPool(workers, jobs, opts, async (job, buf) => {
      frameSizes.push(buf.length);
      if (masterStream && !masterStream.write(buf)) await once(masterStream, 'drain');
      await ff.write(buf);
    });
    const tEnc = performance.now();
    await ff.end();
    if (masterStream) { masterStream.end(); await once(masterStream, 'close'); state.cleanup.delete(masterFile); }
    const encodeTailMs = performance.now() - tEnc;
    checkFatal();
    await fsp.rename(tmpOut, outFile);
    partialOut = null;

    // ---- frame QC gate: find one- or two-frame flashes, re-capture them, re-encode from the patched master
    let qc = 'skipped';
    if (wantMaster && !args['no-qc'] && !preview) {
      const tq = performance.now();
      const threshold = num(args['qc-threshold'], 'qc-threshold', { min: 1, max: 255 }) ?? 12;
      const { report, replacements } = await qcGate({ masterFile, inputCodec, jobs, worker: workers[0], opts, threshold });
      if (replacements.size) {
        await patchMaster(masterFile, frameSizes, replacements);
        log(`qc: replaced ${replacements.size} frame(s); re-encoding from the patched master`);
        partialOut = tmpOut;
        await runFfmpeg(encodeArgs({ input: masterFile, inputCodec, rate, audio, startSec, durSec, crf, preset, audioBitrate, out: tmpOut }), 'qc re-encode');
        await fsp.rename(tmpOut, outFile);
        partialOut = null;
      }
      report.sec = +((performance.now() - tq) / 1000).toFixed(1);
      qc = report;
      log(`qc: ${report.checked} frames checked, ${report.candidates.length} candidate(s), ${report.replaced.length} replaced, ${report.transients.length} kept as transients (${report.sec} s)`);
    }
    if (wantMaster) {
      await fsp.writeFile(masterBase + '.json', JSON.stringify({ fps, rate, inputCodec, f0, f1, startSec, durSec, frames: jobs.length, root, keyframes: ENC.keyframes, created: new Date().toISOString() }, null, 2));
    }

    // ---- poster (straight from Chromium, not from the encode)
    let poster = null;
    const posterAt = args['poster-at'] !== undefined ? num(args['poster-at'], 'poster-at', { min: 0 }) : (Number.isFinite(L.posterTime) ? L.posterTime : Math.max(0, L.duration - 2));
    if (!args['no-poster'] && (full || args['poster-at'] !== undefined) && mode === 'video') {
      const pf = Math.min(totalFrames - 1, Math.round(posterAt * fps));
      const { buf } = await capture(workers[0], pf / fps, opts, { format: 'jpeg', quality: 92 });
      await fsp.writeFile(posterFile, buf);
      poster = { file: posterFile, t: pf / fps, bytes: buf.length };
      log(`poster @ ${(pf / fps).toFixed(3)} s -> ${posterFile}`);
    }
    await closeAll(browser, server);

    // ---- size cap (full render): a 2-pass encode from the master that lands just under the cap (no second capture,
    // no generation loss; the bits go where the film needs them instead of a blunt CRF step)
    let size = (await fsp.stat(outFile)).size;
    let usedCrf = crf, rateControl = `crf ${crf}`;
    const retries = [];
    if (mode === 'video' && full) {
      for (let k = 0; size > maxBytes && k < 3; k++) {
        const target = maxBytes * (0.975 - 0.03 * k);
        log(`${mb(size).toFixed(2)} MB > ${mb(maxBytes)} MB cap: 2-pass encode from the master to ${mb(target).toFixed(2)} MB`);
        const ta = performance.now();
        const kbps = await twoPass({ masterFile, inputCodec, rate, audio, startSec, durSec, preset, audioBitrate, out: tmpOut, targetBytes: target, outDir });
        await fsp.rename(tmpOut, outFile);
        size = (await fsp.stat(outFile)).size;
        usedCrf = null; rateControl = `2-pass ${kbps}k`;
        retries.push({ twoPassKbps: kbps, MB: +mb(size).toFixed(2), sec: +((performance.now() - ta) / 1000).toFixed(1) });
      }
      if (size > maxBytes) warn(`still ${mb(size).toFixed(2)} MB after ${retries.length} 2-pass encodes`);
    }
    // ---- high-bitrate master for uploads (YouTube etc. re-encode; give them the best source)
    let hqMaster = null;
    if (mode === 'video' && full && !args['no-hq-master']) {
      const hq = path.join(path.dirname(outFile), path.basename(outFile, '.mp4') + '-master.mp4');
      const th = performance.now();
      log(`high-bitrate master: crf 14, ${preset}, film, AAC 320k -> ${hq}`);
      await runFfmpeg(encodeArgs({ input: masterFile, inputCodec, rate, audio, startSec, durSec, crf: 14, preset, audioBitrate: '320k', out: hq + '.partial.mp4' }), 'hq master');
      await fsp.rename(hq + '.partial.mp4', hq);
      hqMaster = { file: hq, MB: +mb((await fsp.stat(hq)).size).toFixed(2), sec: +((performance.now() - th) / 1000).toFixed(1) };
    }
    const keepMaster = wantMaster && (args['keep-master'] || size > maxBytes);
    if (wantMaster && !keepMaster) {
      await fsp.rm(masterFile, { force: true });
      await fsp.rm(masterBase + '.json', { force: true });
    }

    const pr = await probe(outFile);
    if (pr.frames !== jobs.length) warn(`output has ${pr.frames} video frames, expected ${jobs.length}`);
    if (pr.duration != null && Math.abs(pr.duration - durSec) > 1.5 / evalRate(rate)) warn(`output duration ${pr.duration} s, expected ${durSec} s`);
    const fixedMs = startupMs + encodeTailMs;
    const projection = (frames) => +(((frames * perf.msPerFrame) + fixedMs) / 1000).toFixed(1);
    await finish({
      ok: true, mode, out: outFile, poster, fps, rate, frames: jobs.length, startSec, durSec,
      workers: workers.length, raster: args.cpu ? 'cpu' : 'gpu', gpu: L.gpu, settle: opts.settle, determinism, qc,
      format: opts.format, quality: opts.quality, crf: usedCrf, rateControl, keyframesForced: ENC.keyframes.length, hqMaster, preset, audioBitrate, retries,
      bytes: size, MB: +mb(size).toFixed(2), probe: pr,
      startupSec: +(startupMs / 1000).toFixed(2), encodeTailSec: +(encodeTailMs / 1000).toFixed(2),
      ...round(perf),
      projected60sFilmSec: { fps60: projection(FILM_SECONDS * 60), fps30: projection(FILM_SECONDS * 30), basis: 'measured ms/frame x frames + startup + encode tail; runs shorter than ~10 s miss x264 back-pressure and under-estimate' },
      master: keepMaster ? masterFile : null,
      warnings: state.warnings,
    }, outDir);
    ok = true;
  } catch (e) {
    fail(e);
    throw state.fatal || e;
  } finally {
    await closeAll(browser, server);
    if (partialOut) await fsp.rm(partialOut, { force: true }).catch(() => {});
    if (!ok) for (const f of state.cleanup) await fsp.rm(f, { force: true }).catch(() => {});
  }
}

async function reencodeOnly({ args, root, outDir, crf, preset, audioBitrate, maxBytes }) {
  if (args.from !== undefined || args.to !== undefined) throw new Error('--reencode works on the kept full-render master; --from/--to are not supported');
  const base = path.join(outDir, '.master');
  if (!fs.existsSync(base + '.json')) throw new Error(`no kept master in ${outDir} (render once with --keep-master)`);
  const m = JSON.parse(await fsp.readFile(base + '.json', 'utf8'));
  ENC.keyframes = m.keyframes || [];
  const masterFile = base + (m.inputCodec === 'png' ? '.pngs' : '.mjpeg');
  const audioPath = path.resolve(root, args.audio || path.join('audio', 'score.wav'));
  const audio = args['no-audio'] ? null : (fs.existsSync(audioPath) ? audioPath : null);
  if (!audio && !args['no-audio']) throw new Error(`score not found: ${audioPath}`);
  const outFile = path.resolve(PROMO_DIR, args.out || path.join(outDir, 'medx-promo.mp4'));
  const tmp = outFile.replace(/\.mp4$/i, '') + '.partial.mp4';
  const a = performance.now();
  log(`re-encoding ${masterFile} (${m.frames} frames at ${m.rate} fps) at crf ${crf}, preset ${preset}`);
  await runFfmpeg(encodeArgs({ input: masterFile, inputCodec: m.inputCodec, rate: m.rate, audio, startSec: m.startSec, durSec: m.durSec, crf, preset, audioBitrate, out: tmp }), 'reencode');
  await fsp.rename(tmp, outFile);
  const size = (await fsp.stat(outFile)).size;
  if (size > maxBytes) warn(`${mb(size).toFixed(2)} MB is over the ${mb(maxBytes)} MB cap; try a higher --crf`);
  await finish({ ok: true, mode: 'reencode', out: outFile, crf, preset, bytes: size, MB: +mb(size).toFixed(2),
    encodeSec: +((performance.now() - a) / 1000).toFixed(1), probe: await probe(outFile), warnings: state.warnings }, outDir);
}

let closed = false;
async function closeAll(browser, server) {
  if (closed) return;
  closed = true;
  state.closing = true;
  await browser.close().catch(() => {});
  await new Promise((r) => server.close(() => r()));
}

async function finish(result, outDir) {
  result.totalSec = +((performance.now() - t0) / 1000).toFixed(1);
  const file = path.join(outDir, 'render-report.json');
  await fsp.writeFile(file, JSON.stringify(result, null, 2));
  log(`done in ${result.totalSec} s -> ${result.out || result.contactSheet}${result.MB != null ? ` (${result.MB} MB)` : ''}; report ${file}`);
  console.log('RESULT ' + JSON.stringify(result));
}

main().then(() => process.exit(state.fatal ? 1 : 0), (e) => {
  if (state.fatal !== e) console.error(`[render ${stamp()}] FATAL ${e && e.stack ? e.stack : e}`);
  process.exit(1);
});
