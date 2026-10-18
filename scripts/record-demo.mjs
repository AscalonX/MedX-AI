#!/usr/bin/env node
/**
 * MedX demo recorder: the "MedX in 60 seconds" product video, the landing stills and the README screens.
 *
 * WHAT IT DOES
 *   Drives a real, running MedX server through the golden synthetic journey (data/cases/DEMO-GOLD.json, English) in
 *   Chromium, clicking the real UI as each demo persona in turn:
 *     patient intake on /patient (a "Try saying" synthetic example with a penicillin allergy) -> nurse queue -> the
 *     "Who's signing in?" sheet and the account menu (synthetic demo identity) -> case (evidence highlight, approve) ->
 *     vitals and the NEWS2-based triage suggestion -> doctor consult (keep a consideration, sign the note) -> order with
 *     a deterministic allergy alert and options for prescriber review -> pharmacist 1 returns it with a report ->
 *     doctor resubmits the suggested option -> pharmacist 1 verifies -> pharmacist 2 (two-person block, sign-in switch,
 *     six-item check, dispense) -> call to counter 2 -> patient phone "ready" -> ops -> case trace.
 *   --video  (default) records it with Playwright recordVideo at 1280x720, adds a title card, a branded caption bar per
 *            step and a closing card with the claim boundary. While a step is live, a tiny corner marker is on screen;
 *            ffmpeg finds every step's exact frames from it, cuts the dead time between steps (page loads, server
 *            work), fits each step to its time budget (speeding a step up with setpts only when it ran long), paints
 *            the marker out, joins the steps with short cross-fades and encodes H.264.
 *            Output: apps/web/public/media/<name>.mp4 (+faststart, yuv420p), <name>-poster.jpg (a real frame of
 *            the video) and <name>.en.vtt (captions with real timings); <name> is medx-demo unless --name or --narration.
 *   --stills replays the same journey without overlays: staff pages at 1100x860 @2x, the patient app at 390x844 @3x.
 *            Writes the landing crops apps/web/public/landing/<name>.webp at native capture pixels, the full phone
 *            screens patient-home, patient-intake and patient-pickup-phone (1170x2532, for device mockups), and the
 *            README screens docs/readme/s-*.png|jpg + journey.png.
 *   Both flags can be combined; each run starts from a reset demo store when --token is given.
 *
 * REQUIREMENTS
 *   - A MedX production server with synthetic demo data and a PRIVATE store, e.g. from apps/web:
 *       MEDX_STORE=file MEDX_STORE_PATH=<temp file outside the repo> MODEL_PROVIDER=mock DEMO_SEED=1 DEMO_AUTOSEED=1 \
 *       DEMO_TOKEN=<token> MEDX_RATE_LIMIT_PER_MIN=0 next start -p 3131
 *     Never point it at the shared Neon store: the journey writes a new synthetic case and resets the demo cases.
 *   - Playwright >= 1.56 with Chromium. Resolved from PLAYWRIGHT_DIR (a folder whose node_modules has playwright),
 *     then this repo, then ~/medx-tools.
 *   - ffmpeg with libx264 and libwebp: FFMPEG=<path> or --ffmpeg <path> (default "ffmpeg" on PATH).
 *
 * USAGE (repo root)
 *   node scripts/record-demo.mjs --base http://localhost:3131 --token <DEMO_TOKEN> [--video] [--stills]
 *        [--ffmpeg <path>] [--work <dir>] [--debug] [--no-reset] [--takes 3]
 *   --work   scratch folder for raw recordings and debug frames (default: <os tmp>/medx-record-demo)
 *   --takes  video attempts: a take where any step ran more than MAX_OVERRUN past its budget (a stall under machine
 *            load) is recorded again from a reset store instead of being sped up (default 3)
 *   --debug  also saves a PNG at the end of every step into --work
 *   --journey-only  re-renders docs/readme/journey.png from journey.html and the current s-*.png/jpg (no journey)
 *   --out    folder for medx-demo.mp4, its poster and VTT (default apps/web/public/media); stills keep their paths
 *   --name   base name of the video files (default medx-demo; with --narration medx-demo-narrated): <name>.mp4,
 *            <name>-poster.jpg, <name>.en.vtt. /media is cached for a year (next.config.ts), so a new cut needs a new name.
 *
 * NARRATION (optional, video only)
 *   --narration <manifest.json>  a voice-over manifest: {"root": <folder>, "walkthrough": [{"step": <STEPS id>,
 *            "file": <wav, relative to root>, "text": <the line as written>, "cues": [{"on": <word>, "measuredSec": <s>}]}]}.
 *            A <wav>.asr.json next to a line ({"words": [{"w", "s", "e"}]}) times its caption sentences.
 *            Each narrated step's budget becomes max(budget, line length + NARR_TAIL), rounded up to whole frames (the
 *            first step also waits NARR_LEAD_FIRST for the title card, the last holds NARR_END_HOLD after its line).
 *            On-screen actions wait for their cue word (Recorder.cue), so the click lands as the word is spoken.
 *            Each line is placed at its step's start in the finished cut (+ NARR_LEAD), mixed over an optional bed,
 *            mastered to --lufs (default -16 LUFS integrated, true peak below -1 dBTP) and muxed as AAC 192 kb/s.
 *            The VTT then carries the narration text, one cue per sentence, at the real spoken times, each cue placed
 *            (WebVTT line setting) above that step's burned-in caption bar so both stay readable.
 *            The narrated cut adds one step, `thai` (after `evidence`): a seeded Thai visit (MED-01) in the same nurse
 *            view, its fields beside the patient's own Thai words (read only). --no-thai leaves it out.
 *   --bed <wav>      optional music bed under the narration (looped if short, faded in and out)
 *   --bed-lufs <n>    the bed's integrated loudness in the finished mix (default -30)
 *
 * TIMING
 *   Each step has a budget in STEPS below (seconds). The finished video length is
 *   sum(budgets) - (steps - 1) * FADE and is checked against 55..65 s (with --narration: the same sum, +/- 1.5 s);
 *   the run fails outside that window.
 *
 * SAFETY
 *   Synthetic data only. Every clinical action is a click in the real UI by a named demo persona; the only things
 *   drawn on top are the labelled caption bar, the title and closing cards and a focus ring. No real patient data.
 */
import fs from 'node:fs';
import os from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- CLI ----------
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) o[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) o[a.slice(2)] = argv[++i];
    else o[a.slice(2)] = true;
  }
  return o;
}
const args = parseArgs(process.argv.slice(2));
const BASE = String(args.base || process.env.MEDX_BASE || 'http://localhost:3131').replace(/\/$/, '');
const TOKEN = String(args.token || process.env.DEMO_TOKEN || '');
const FFMPEG = String(args.ffmpeg || process.env.FFMPEG || 'ffmpeg');
const WORK = path.resolve(String(args.work || path.join(os.tmpdir(), 'medx-record-demo')));
const DEBUG = !!args.debug;
const DO_STILLS = !!args.stills;
const DO_VIDEO = !!args.video || !DO_STILLS;
const RESET = !args['no-reset'];

const OUT_MEDIA = args.out && args.out !== true ? path.resolve(String(args.out)) : path.join(ROOT, 'apps/web/public/media');
// Base name of the video, poster and captions. The narrated cut never takes the silent cut's name (cached for a year).
const NAME = args.name && args.name !== true ? String(args.name).replace(/[^\w.-]/g, '') : (args.narration && args.narration !== true ? 'medx-demo-narrated' : 'medx-demo');
const OUT_LANDING = path.join(ROOT, 'apps/web/public/landing');
const OUT_README = path.join(ROOT, 'docs/readme');

// ---------- Video constants ----------
const W = 1280;
const H = 720;
const FPS = 25;
const FADE = 0.25; // cross-fade between steps, seconds
const CRF = 28;
const MAX_MB = 15;
const MAX_SPEED = 2.2; // never speed a step up more than this
const MAX_OVERRUN = 0.6; // seconds a step may run past its budget (wall clock) before the take is recorded again
const TAKES = Math.max(1, Number(args.takes) || 3); // --takes N: attempts for a clean video take

// ---------- Narration constants (--narration) ----------
const NARR_TAIL = 0.6; // a narrated step's budget is at least its line + this
const NARR_LEAD = 0.12; // a line starts this long after its step's cut begins (inside the cross-fade)
const NARR_LEAD_FIRST = 0.4; // the opening line waits for the title card's entrance
const NARR_END_HOLD = 1.0; // the closing card holds this long after its line
const NARR_CUE_LEAD = 0.2; // an action cued to a word starts this long before the word
const NARR_MAX_MB = 25;
const TARGET_LUFS = Number.isFinite(Number(args.lufs)) ? Number(args.lufs) : -16;
const LIMIT_DBTP = -2.0; // limiter ceiling before AAC; the encoded file is checked against -1 dBTP
const BED = args.bed && args.bed !== true ? path.resolve(String(args.bed)) : null;
const BED_LUFS = Number.isFinite(Number(args['bed-lufs'])) ? Number(args['bed-lufs']) : -30;

// ---------- Synthetic golden journey (single source: data/cases/DEMO-GOLD.json) ----------
const GOLD = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cases/DEMO-GOLD.json'), 'utf8')).demo;
const STAFF = {
  nurse: 'Nurse Anna Rossi',
  doctor: 'Dr. Marco Bianchi',
  p1: 'Pharmacist Laura Conti',
  p2: 'Pharmacist Nattaya Wong',
  ops: 'Head Nurse Elena Greco',
};
const NOT_ASSESSED = 'Not assessed in this synthetic demo visit';

// Brand tokens (packages/shared/src/tokens.ts). Overlays use only these.
const T = {
  desk: '#EEF3F6', paper: '#F5F8FA', sheet: '#FFFFFF', ink: '#0F1E2E', inkRaised: '#173A63', inkSoft: '#45566A',
  rule: '#E3E9EF', teal: '#08716A', ocean: '#1A5CBF', from: '#0A8077', to: '#1A5FC4', tealTint: '#E1F4F1', oceanTint: '#E5EEFB',
};
// White lockup straight from the shipped logo module (vector, no font dependency).
const LOCKUP_WHITE = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'apps/web/components/ui/logoSvg.ts'), 'utf8');
  const m = src.match(/export const LOCKUP_WHITE = (".*?");\s*$/m);
  return m ? JSON.parse(m[1]) : '';
})();

/**
 * Step budgets (seconds) and captions. `who` is the persona, `text` one short line (house style: sentence case,
 * no dashes, no exclamation marks; decision-support wording).
 */
const STEPS = {
  title: { t: 3.0 },
  intake: { t: 4.2, who: 'Patient', text: 'Picks a synthetic example, allergy included, and checks every word before sending' },
  sent: { t: 2.2, who: 'Patient', text: 'Gets a visit code. A nurse reviews before anything is final' },
  queue: { t: 2.2, who: 'Nurse', text: 'The new visit arrives in the review queue' },
  signin: { t: 2.8, who: 'Nurse', text: 'Signs in as a synthetic demo nurse. Every change is recorded under that name' },
  evidence: { t: 4.0, who: 'Nurse', text: 'Every field cites the patient’s own words, checked by code' },
  // Narrated cut only (removed below otherwise): a seeded Thai visit in the same nurse view.
  thai: { t: 3.0, who: 'Nurse', text: 'A Thai visit: every field cites the patient’s own Thai words' },
  vitals: { t: 4.4, who: 'Nurse', text: 'Records vitals. NEWS2 suggests a triage level; the nurse confirms it' },
  consider: { t: 3.2, who: 'Doctor', text: 'Keeps the rule-based considerations they agree with. Not a diagnosis' },
  signed: { t: 2.6, who: 'Doctor', text: 'Signs the visit note. Nothing is final until a clinician signs' },
  order: { t: 4.4, who: 'Doctor', text: 'Prescribing checks run as code: a penicillin allergy alert, with options to review' },
  ret: { t: 4.2, cap: 84, who: 'Pharmacist 1', text: 'Returns the order with a report and an option for prescriber review' },
  resubmit: { t: 3.4, who: 'Doctor', text: 'Reviews the option and resubmits clarithromycin' },
  verify: { t: 2.6, cap: 84, who: 'Pharmacist 1', text: 'Verifies the corrected prescription' },
  block: { t: 2.8, cap: 84, who: 'Pharmacist 2', text: 'Two-person rule: whoever verified cannot also dispense' },
  dispense: { t: 3.2, cap: 84, who: 'Pharmacist 2', text: 'Six-item final check, then dispense' },
  call: { t: 2.4, cap: 84, who: 'Pharmacist 2', text: 'Calls the patient to counter 2' },
  ready: { t: 2.8, who: 'Patient', text: 'The phone shows the medicine is ready at counter 2' },
  // Text set in run() from /api/health (modelCaption): the burned-in caption never claims a model the server does not run.
  ops: { t: 2.6, who: 'Operations', text: '' },
  trace: { t: 3.4, who: 'Case trace', text: 'Every rule check, model call and human decision, in order' },
  closing: { t: 4.2 },
};
// The silent 60 s cut keeps its 18 captioned steps; the Thai step belongs to the narrated cut.
if (!args.narration || args.narration === true || args['no-thai']) delete STEPS.thai;
const STEP_IDS = Object.keys(STEPS);
const CAPTIONED = STEP_IDS.filter((k) => STEPS[k].who);

// ---------- Small utilities ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[record-demo ${new Date().toISOString().slice(11, 19)}]`, ...a);
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function ff(argv, opts = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-y', ...argv], { encoding: opts.binary ? 'buffer' : 'utf8', maxBuffer: 1 << 30 });
  if (r.error) throw new Error(`ffmpeg failed to start (${FFMPEG}): ${r.error.message}`);
  if (r.status !== 0 && !opts.allowFail) throw new Error(`ffmpeg exited ${r.status}: ${String(r.stderr).slice(-2000)}`);
  return r;
}
function mediaDuration(file) {
  const r = ff(['-i', file], { allowFail: true });
  const m = String(r.stderr).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN;
}
async function api(pathname, init) {
  const r = await fetch(BASE + pathname, init);
  if (!r.ok) throw new Error(`${init?.method || 'GET'} ${pathname} -> ${r.status} ${await r.text().catch(() => '')}`);
  return r.json();
}

// ---------- Narration manifest ----------
/** Reads a --narration manifest: one line per step, its WAV length measured from the file itself. */
function loadNarration(file) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(m) ? m : m.walkthrough || m.steps;
  if (!Array.isArray(list) || !list.length) throw new Error(`${file}: no "walkthrough" list of narration lines`);
  const root = m.root && fs.existsSync(m.root) ? m.root : path.dirname(file);
  const lines = {};
  for (const e of list) {
    if (e.step === 'thai' && args['no-thai']) continue;
    if (!STEPS[e.step]) throw new Error(`narration: unknown step "${e.step}"`);
    if (lines[e.step]) throw new Error(`narration: step "${e.step}" has two lines`);
    const wav = path.resolve(root, String(e.file || ''));
    if (!e.file || !fs.existsSync(wav)) throw new Error(`narration: line for "${e.step}" has no WAV (${wav})`);
    const sec = mediaDuration(wav);
    if (!(sec > 0)) throw new Error(`narration: cannot read the length of ${wav}`);
    const text = String(e.text || '').trim();
    if (!text) throw new Error(`narration: line for "${e.step}" has no text`);
    const asr = wav.replace(/\.wav$/i, '.asr.json');
    const words = fs.existsSync(asr) ? (JSON.parse(fs.readFileSync(asr, 'utf8')).words || []).filter((w) => w && Number.isFinite(w.s)) : [];
    const cues = {};
    for (const c of e.cues || []) {
      const at = Number(c.measuredSec ?? c.estSec);
      if (c.on && Number.isFinite(at)) cues[c.on] = at;
    }
    lines[e.step] = { step: e.step, wav, sec, text, cues, words };
  }
  return { file, lines };
}
const NARR = args.narration && args.narration !== true ? loadNarration(path.resolve(String(args.narration))) : null;
/** Where a step's line starts inside the step (seconds after its cut begins). */
const narrLead = (id) => (STEP_IDS[0] === id ? NARR_LEAD_FIRST : NARR_LEAD);
if (NARR) {
  // Budgets long enough for each line, on whole frames so the cut keeps exactly the planned length.
  STEP_IDS.forEach((id, i) => {
    const l = NARR.lines[id];
    if (!l) return;
    const need = l.sec + NARR_TAIL + (narrLead(id) - NARR_LEAD) + (i === STEP_IDS.length - 1 ? NARR_END_HOLD : 0);
    STEPS[id].t = Math.max(STEPS[id].t, Math.ceil(need * FPS - 1e-6) / FPS);
  });
}
/** Accepted video length: 55..65 s, or with narration the sum of the budgets less the cross-fades, +/- 1.5 s. */
function lengthWindow() {
  if (!NARR) return [55, 65];
  const planned = STEP_IDS.reduce((a, id) => a + STEPS[id].t, 0) - (STEP_IDS.length - 1) * FADE;
  return [planned - 1.5, planned + 1.5];
}

function loadPlaywright() {
  const dirs = [process.env.PLAYWRIGHT_DIR, process.cwd(), ROOT, path.join(ROOT, 'apps/web'), path.join(os.homedir(), 'medx-tools')].filter(Boolean);
  for (const d of dirs) {
    try {
      const req = createRequire(path.join(path.resolve(d), 'noop.js'));
      const pw = req('playwright');
      if (pw?.chromium) return pw;
    } catch { /* try the next folder */ }
  }
  throw new Error('Playwright not found. Install it (npm i playwright; npx playwright install chromium) and set PLAYWRIGHT_DIR.');
}

// ---------- In-page overlays (injected with page.evaluate; CSP allows inline styles) ----------
const FONT = 'var(--font-sans, var(--font-jakarta, system-ui)), system-ui, sans-serif';
const BASE_CSS = `
#mx-cap{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483600;display:flex;align-items:center;gap:12px;
 padding:7px 20px 7px 7px;border-radius:999px;background:linear-gradient(160deg,${T.ink}F2,${T.inkRaised}F2);color:#fff;
 box-shadow:0 18px 40px -16px rgba(15,30,46,.55),0 0 0 1px rgba(255,255,255,.08) inset;font:600 16px/1.25 ${FONT};
 white-space:nowrap;pointer-events:none;letter-spacing:-.005em;-webkit-font-smoothing:antialiased}
#mx-cap .n{display:grid;place-items:center;height:30px;min-width:30px;padding:0 10px;border-radius:999px;
 background:linear-gradient(135deg,${T.from},${T.to});font-weight:800;font-size:13px;font-variant-numeric:tabular-nums}
#mx-cap .who{font-weight:800;color:${T.tealTint}}
#mx-cap .dot{width:4px;height:4px;border-radius:2px;background:rgba(255,255,255,.45)}
#mx-cap .txt{color:#fff;font-weight:500}
#mx-spot{position:fixed;z-index:2147483500;pointer-events:none;border-radius:18px;border:3px solid ${T.ocean};
 box-shadow:0 0 0 7px ${T.oceanTint}B3,0 12px 30px -12px rgba(26,92,191,.45);animation:mxspot .45s cubic-bezier(.22,1,.36,1) both}
@keyframes mxspot{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:none}}
#mx-stage{position:fixed;inset:0;z-index:2147483400;overflow:hidden;font-family:${FONT};-webkit-font-smoothing:antialiased}
#mx-stage *{box-sizing:border-box}
@keyframes mxup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes mxbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
`;

async function ensureCss(page) {
  await page.evaluate((css) => {
    let st = document.getElementById('mx-css');
    if (!st) { st = document.createElement('style'); st.id = 'mx-css'; document.head.appendChild(st); }
    st.textContent = css;
  }, BASE_CSS);
}
async function setOverlay(page, id, html) {
  await ensureCss(page);
  await page.evaluate(({ id, html }) => {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
    el.innerHTML = html;
  }, { id, html });
}
async function removeOverlay(page, id) {
  await page.evaluate((id) => document.getElementById(id)?.remove(), id).catch(() => {});
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function captionHtml(id) {
  const s = STEPS[id];
  const n = CAPTIONED.indexOf(id) + 1;
  return `<span class="n">${n}/${CAPTIONED.length}</span><span class="who">${esc(s.who)}</span><span class="dot"></span><span class="txt">${esc(s.text)}</span>`;
}

function titleHtml() {
  return `<div style="position:absolute;inset:0;background:radial-gradient(900px 520px at 78% 30%,rgba(255,255,255,.20),transparent 60%),radial-gradient(700px 500px at 8% 100%,rgba(255,255,255,.10),transparent 60%),linear-gradient(135deg,${T.from},${T.to})"></div>
  <div style="position:absolute;right:-120px;top:-160px;width:560px;height:560px;border-radius:50%;border:1px solid rgba(255,255,255,.14)"></div>
  <div style="position:absolute;left:104px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center;gap:22px;color:#fff;animation:mxup .6s cubic-bezier(.22,1,.36,1) both">
    <div style="height:58px">${LOCKUP_WHITE.replace('<svg ', '<svg style="height:58px;width:auto" ')}</div>
    <div style="font-weight:800;font-size:78px;line-height:1.02;letter-spacing:-.035em">Every word,<br><span style="color:${T.tealTint}">understood.</span></div>
    <div style="font-size:21px;line-height:1.5;max-width:560px;color:rgba(255,255,255,.92)">Multilingual pre-visit intake. Fin listens while nurses, doctors and pharmacists decide.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${['Synthetic data only', 'English, Thai, Italian', NARR ? 'One visit, start to finish' : 'One visit, about 60 seconds'].map((c) => `<span style="height:36px;display:inline-flex;align-items:center;padding:0 16px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);font-weight:700;font-size:14px">${c}</span>`).join('')}
    </div>
  </div>
  <div style="position:absolute;right:96px;top:50%;width:430px;height:430px;margin-top:-215px;border-radius:50%;background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.34),rgba(255,255,255,.12) 62%,transparent 72%)"></div>
  <img src="/brand/fin-wave-1024.webp" alt="" style="position:absolute;right:118px;top:50%;width:390px;height:390px;margin-top:-205px;object-fit:contain;animation:mxbob 3.2s ease-in-out infinite">`;
}

function closingHtml() {
  return `<div style="position:absolute;inset:0;background:radial-gradient(800px 500px at 85% 0%,rgba(26,95,196,.45),transparent 60%),linear-gradient(160deg,${T.ink},${T.inkRaised})"></div>
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 112px;gap:26px;color:#fff;animation:mxup .6s cubic-bezier(.22,1,.36,1) both">
    <div style="height:44px">${LOCKUP_WHITE.replace('<svg ', '<svg style="height:44px;width:auto" ')}</div>
    <div style="font-weight:800;font-size:60px;line-height:1.08;letter-spacing:-.03em">Research prototype.<br>Synthetic data.<br><span style="color:${T.tealTint}">Clinicians decide.</span></div>
    <div style="font-size:19px;line-height:1.55;max-width:700px;color:rgba(255,255,255,.86)">MedX supports clinicians. It suggests for review and flags for clinicians; it does not diagnose, prescribe or decide urgency. Not a medical device.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${['medx.areazeroai.com', 'Built for AMD Developer Hackathon ACT III'].map((c) => `<span style="height:36px;display:inline-flex;align-items:center;padding:0 16px;border-radius:999px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);font-weight:700;font-size:14px">${c}</span>`).join('')}
    </div>
  </div>
  <div style="position:absolute;right:120px;top:50%;width:300px;height:300px;margin-top:-150px;border-radius:50%;background:radial-gradient(circle,rgba(26,95,196,.35),transparent 70%)"></div>
  <img src="/brand/mark-3d-512.webp" alt="" style="position:absolute;right:140px;top:50%;width:260px;height:260px;margin-top:-130px;object-fit:contain">`;
}

/**
 * Mist stage with a phone frame around the real patient app (same origin iframe, 390 CSS px wide, shown at 80%).
 * The screen keeps a status-bar inset with a camera pill above the app, so the app's top edge never touches the bezel.
 */
function phoneStageHtml({ src, eyebrow, a, b, sub }) {
  const scale = 0.8;
  const vw = 390;
  const screenH = 760; // CSS px of screen inside the bezel (shown at 80%)
  const inset = 26; // status-bar inset, CSS px
  const vh = screenH - inset; // the patient app's own viewport height
  return `<div style="position:absolute;inset:0;background:radial-gradient(700px 520px at 12% 8%,${T.tealTint},transparent 62%),radial-gradient(760px 560px at 92% 96%,${T.oceanTint},transparent 60%),${T.desk}"></div>
  <div style="position:absolute;left:120px;top:0;bottom:70px;width:560px;display:flex;flex-direction:column;justify-content:center;gap:18px;color:${T.ink}">
    <span style="align-self:flex-start;height:34px;display:inline-flex;align-items:center;gap:8px;padding:0 14px;border-radius:999px;background:${T.sheet};border:1px solid ${T.rule};font-weight:700;font-size:14px;color:${T.teal}"><span style="width:8px;height:8px;border-radius:4px;background:${T.teal}"></span>${esc(eyebrow)}</span>
    <div style="font-weight:800;font-size:54px;line-height:1.05;letter-spacing:-.03em">${esc(a)}<br><span style="background:linear-gradient(135deg,${T.from},${T.to});-webkit-background-clip:text;background-clip:text;color:transparent">${esc(b)}</span></div>
    <div style="font-size:19px;line-height:1.55;color:${T.inkSoft};max-width:500px">${esc(sub)}</div>
  </div>
  <div style="position:absolute;left:776px;top:22px;width:${vw * scale + 24}px;height:${screenH * scale + 24}px;border-radius:48px;background:${T.ink};padding:12px;box-shadow:0 40px 80px -30px rgba(15,45,80,.45),0 0 0 1px rgba(15,30,46,.06)">
    <div style="width:${vw * scale}px;height:${screenH * scale}px;border-radius:37px;overflow:hidden;background:${T.paper};position:relative">
      <div style="position:absolute;left:50%;top:${Math.round(inset * scale / 2 - 7)}px;width:74px;height:14px;margin-left:-37px;border-radius:7px;background:${T.ink}"></div>
      <iframe src="${src}" title="Patient app" style="position:absolute;left:0;top:${inset * scale}px;width:${vw}px;height:${vh}px;border:0;transform:scale(${scale});transform-origin:0 0;background:${T.paper}"></iframe>
    </div>
  </div>`;
}

// ---------- Recorder ----------
class Recorder {
  constructor(mode) {
    this.mode = mode; // 'video' | 'stills'
    this.segs = [];
    this.page = null;
    this.cur = null; // the step being recorded: { id, start }
    this.cueLog = []; // narration: when each cued action ran against its word (seconds into the step)
  }
  get video() { return this.mode === 'video'; }
  /** A video pause. With narration it stops at the step's budget: frames past the budget are cut anyway. */
  async pause(ms) {
    if (NARR && this.cur) ms = Math.min(ms, Math.max(0, this.cur.start + STEPS[this.cur.id].t * 1000 - performance.now()));
    if (ms > 0) await this.page.waitForTimeout(ms);
  }
  /**
   * Narration only (a no-op otherwise): waits until the current step's line reaches the word `on`, less `lead`
   * seconds, so the action that follows lands as the word is spoken. A step whose line has no such cue goes on at once.
   */
  async cue(on, lead = NARR_CUE_LEAD) {
    if (!this.video || !NARR || !this.cur) return;
    const { id, start } = this.cur;
    const at = NARR.lines[id]?.cues[on];
    if (at === undefined) { if (NARR.lines[id]) log(`note: step ${id} has no narration cue "${on}"`); return; }
    const target = start + (narrLead(id) + at - lead) * 1000;
    const wait = target - performance.now();
    if (wait > 0) await this.page.waitForTimeout(wait);
    const now = performance.now();
    this.cueLog.push({ step: id, on, wordSec: Number((narrLead(id) + at).toFixed(2)), actionSec: Number(((now - start) / 1000).toFixed(2)), lateSec: Number(((now - target) / 1000).toFixed(2)) });
  }
  async painted(page = this.page) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
  }
  async caption(id) {
    if (!this.video) return;
    if (!STEPS[id].who) { await removeOverlay(this.page, 'mx-cap'); return; }
    await setOverlay(this.page, 'mx-cap', captionHtml(id));
    await this.page.evaluate((b) => { const c = document.getElementById('mx-cap'); c.style.transition = ''; c.style.bottom = `${b}px`; }, STEPS[id].cap ?? 14);
  }
  async spot(locator, pad = 8) {
    if (!this.video) return;
    const b = await locator.boundingBox().catch(() => null);
    if (!b) return;
    await setOverlay(this.page, 'mx-spot', '');
    await this.page.evaluate(({ x, y, w, h }) => {
      const el = document.getElementById('mx-spot');
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    }, { x: b.x - pad, y: b.y - pad, w: b.width + pad * 2, h: b.height + pad * 2 });
  }
  async unspot() { if (this.video) await removeOverlay(this.page, 'mx-spot'); }
  /**
   * One visible step: caption, step marker on, actions, hold until the budget is used, marker off.
   * The marker is an 8x8 px block in the bottom-right corner, magenta for even steps and green for odd ones, drawn in
   * the same paint as the step's content. ffmpeg finds each step's exact frames from it (Playwright's video clock is
   * not linear with wall time, so wall-clock marks cannot place cuts) and the final encode paints it out (delogo).
   */
  async seg(id, actions) {
    const page = this.page;
    if (!this.video) { await actions?.(); return; }
    await this.caption(id);
    await setOverlay(page, 'mx-mark', '');
    await page.evaluate((c) => {
      Object.assign(document.getElementById('mx-mark').style, { position: 'fixed', right: '4px', bottom: '4px', width: `8px`, height: `8px`, background: c, zIndex: '2147483647', pointerEvents: 'none' });
    }, this.segs.length % 2 ? '#00FF00' : '#FF00FF');
    await this.painted();
    const start = performance.now();
    this.cur = { id, start };
    try {
      await actions?.();
    } finally {
      this.cur = null;
    }
    const left = start + STEPS[id].t * 1000 + 160 - performance.now();
    if (left > 0) await page.waitForTimeout(left);
    await removeOverlay(page, 'mx-mark');
    await this.painted();
    const end = performance.now();
    this.segs.push({ id, start, end });
    if (DEBUG) await page.screenshot({ path: path.join(WORK, `dbg-${String(this.segs.length).padStart(2, '0')}-${id}.png`) }).catch(() => {});
    await this.unspot();
    log(`step ${id}: ${((end - start) / 1000).toFixed(2)} s wall (budget ${STEPS[id].t} s)`);
  }
}

// ---------- Journey helpers ----------
async function asRole(page, role, name) {
  await page.evaluate(([role, name]) => {
    localStorage.setItem('medx.lang', 'en');
    localStorage.setItem('medx.role', role);
    if (role === 'nurse' || role === 'doctor') localStorage.setItem('medx.clinicianRole', role);
    localStorage.setItem(`medx.reviewer.${role}`, name);
  }, [role, name]);
}
/**
 * Role chosen but nobody signed in yet (no medx.reviewer.<role>): staff pages then show the "Who's signing in?" sheet
 * and gate every write until a name is chosen (app/_shared/SignIn.tsx). Reading stays open.
 */
async function asRoleUnsigned(page, role) {
  await page.evaluate((role) => {
    localStorage.setItem('medx.lang', 'en');
    localStorage.setItem('medx.role', role);
    if (role === 'nurse' || role === 'doctor') localStorage.setItem('medx.clinicianRole', role);
    localStorage.removeItem(`medx.reviewer.${role}`);
  }, role);
}
/**
 * Scrolls the window so `locator` sits `top` CSS px below the viewport top and waits until it stays there (late
 * layout shifts and focus moves can scroll the page after the first jump). Gives up quietly after about 3 s.
 */
async function settleAt(locator, top = 24, stable = 2) {
  let same = 0;
  for (let i = 0; i < 12 + stable * 2 && same < stable; i++) {
    const y = await locator.evaluate((el, top) => {
      const r = el.getBoundingClientRect();
      if (Math.abs(r.top - top) > 3) window.scrollTo({ top: r.top + window.scrollY - top, behavior: 'instant' });
      return el.getBoundingClientRect().top;
    }, top);
    await sleep(250);
    const now = await locator.evaluate((el) => el.getBoundingClientRect().top);
    same = Math.abs(now - y) < 2 && Math.abs(now - top) < 4 ? same + 1 : 0;
  }
}
/**
 * Video only: if `locator` (a control about to be clicked) sits under the caption bar of step `id`, smooth-scroll the
 * window just enough to clear it. The caption bar is about 44 px tall, `cap` px above the bottom edge.
 */
async function clearOfCaption(page, locator, id) {
  const limit = H - (STEPS[id].cap ?? 14) - 44 - 18;
  const b = await locator.boundingBox().catch(() => null);
  if (!b || b.y + b.height <= limit) return;
  await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), Math.round(b.y + b.height - limit + 40));
  // Wait until the smooth scroll has really finished (unchanged for 200 ms), then a beat so the video catches up.
  let last = -1;
  let still = 0;
  for (let i = 0; i < 30 && still < 4; i++) {
    await sleep(50);
    const y = await page.evaluate(() => window.scrollY);
    still = y === last ? still + 1 : 0;
    last = y;
  }
  await sleep(200);
}
/** Window at the top; the row's own scrolling list (if any) scrolled so the row sits `offset` px below the list top. */
async function rowInList(row, offset = 8) {
  await row.evaluate((el, offset) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    for (let n = el.parentElement; n; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 4) {
        n.scrollTop += el.getBoundingClientRect().top - n.getBoundingClientRect().top - offset;
        break;
      }
    }
  }, offset);
  await sleep(200);
}
async function go(page, url, ready) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  if (ready) await ready.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
}
async function smoothInto(locator, block = 'center') {
  await locator.evaluate((el, block) => el.scrollIntoView({ behavior: 'smooth', block }), block);
  await sleep(650);
}
async function instantInto(locator, block = 'center') {
  await locator.evaluate((el, block) => el.scrollIntoView({ behavior: 'instant', block }), block);
  await sleep(120);
}
async function sessionByCode(code) {
  const list = await api('/api/sessions');
  const s = list.find((x) => x.code === code);
  if (!s) throw new Error(`session ${code} not found`);
  return s;
}

// ---------- Stills ----------
const stillsQueue = [];
/** Captures one still: element (or clip) screenshot to PNG, converted to WebP/PNG/JPEG later. */
async function snap(rec, name, target, opts = {}) {
  if (rec.mode !== 'stills') return;
  const page = opts.page || rec.page;
  const file = path.join(WORK, `still-${name}.png`);
  let clip = opts.clip;
  if (!clip && target) {
    const b = await target.boundingBox();
    if (!b) throw new Error(`still ${name}: target not visible`);
    const pad = opts.pad ?? 0;
    clip = { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 };
    if (opts.aspect) {
      // Keep the width, set the height from the aspect (w/h), anchored at the top unless anchor = 'center'.
      const h = clip.width / opts.aspect;
      if (opts.anchor === 'center') clip.y += (clip.height - h) / 2;
      clip.height = h;
    }
  }
  if (clip) {
    const vp = page.viewportSize();
    clip = { x: Math.max(0, clip.x), y: Math.max(0, clip.y), width: Math.min(clip.width, vp.width - Math.max(0, clip.x)), height: Math.min(clip.height, vp.height - Math.max(0, clip.y)) };
  }
  await page.screenshot({ path: file, clip, fullPage: false, animations: 'disabled' });
  stillsQueue.push({ name, file, aspect: clip ? clip.width / clip.height : null, ...opts.out });
  log(`still ${name}`);
}

const STILLS_VP = { width: 1100, height: 860 }; // narrow enough that each card crop stays legible in a bento card
const README_VP = { width: 1280, height: 800 };
const PHONE_VP = { width: 390, height: 844 }; // patient app stills, captured @3x
/**
 * Full phone screen of the patient app (390x844 @3x = 1170x2532), for device mockups (the cinematic promo).
 * Waits for images (Fin) to decode first. Written to public/landing/<name>.webp at native size.
 */
async function phoneShot(rec, pPage, name) {
  if (rec.mode !== 'stills') return;
  await pPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await pPage.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {}))))).catch(() => {});
  await pPage.evaluate(() => document.fonts?.ready).catch(() => {});
  await sleep(500);
  await snap(rec, name, null, { page: pPage, clip: { x: 0, y: 0, ...PHONE_VP } });
}
/** Scrolls the window so `anchor` sits `top` CSS px below the viewport top. */
async function scrollAnchor(page, anchor, top = 90) {
  await anchor.evaluate((el, top) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - top, behavior: 'instant' }), top);
  await sleep(300);
}
/** Still from a region computed from the anchor's box (after an optional scroll): region(box) -> {x, y, width, height}. */
async function snapAt(rec, name, anchor, region, { top = 90, page = rec.page, scroll = true, out = {} } = {}) {
  if (rec.mode !== 'stills') return;
  if (scroll) await scrollAnchor(page, anchor, top);
  // Re-scroll until the whole region is inside the viewport (late focus changes can move the page after a scroll).
  let clip;
  for (let i = 0; i < 4; i++) {
    const b = await anchor.boundingBox();
    if (!b) throw new Error(`still ${name}: anchor not visible`);
    clip = region(b);
    const vh = page.viewportSize().height;
    if (!scroll || (clip.y >= 0 && clip.y + clip.height <= vh - 2)) break;
    await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'instant' }), clip.y - 40);
    await sleep(500);
  }
  if (DEBUG) await page.screenshot({ path: path.join(WORK, `dbg-vp-${name}.png`) });
  await snap(rec, name, null, { page, clip, out });
}
/** README screen at 1280x800: `prep` arranges the page at that size; the stills viewport is restored after. */
async function readmeShot(rec, name, file, prep) {
  if (rec.mode !== 'stills') return;
  const page = rec.page;
  await page.setViewportSize(README_VP);
  await sleep(600);
  await prep?.();
  await sleep(300);
  await snap(rec, name, null, { clip: { x: 0, y: 0, width: README_VP.width, height: README_VP.height }, out: { readme: file } });
  await page.setViewportSize(STILLS_VP);
  await sleep(500);
}

// ---------- The journey ----------
async function journey(rec, ctx) {
  const page = rec.page;
  const video = rec.video;
  const pause = (ms) => (video ? rec.pause(ms) : Promise.resolve());
  // With --narration: wait for a word of the step's line before the next action (no-op otherwise).
  const cue = (on, lead) => rec.cue(on, lead);

  // Land on the site so the page has the brand fonts and CSS tokens; overlays sit above it.
  await go(page, '/', page.getByRole('heading', { level: 1 }).first());

  // 1. Title card
  if (video) await setOverlay(page, 'mx-stage', titleHtml());
  if (video) await page.locator('#mx-stage img').evaluate((img) => img.decode?.()).catch(() => {});
  await rec.seg('title');

  // 2. Patient intake on /patient, inside a phone frame (video) or a phone-sized page (stills)
  let pFrame;
  let pPage = null;
  let pCtx = null;
  if (video) {
    await setOverlay(page, 'mx-stage', phoneStageHtml({ src: '/patient/?new=1&lang=en', eyebrow: 'Patient app', a: 'Tell Fin what', b: 'brings you in.', sub: 'By voice or text, in English, Thai or Italian. The patient checks every word before it is sent.' }));
    const handle = await page.waitForSelector('#mx-stage iframe');
    pFrame = await handle.contentFrame();
  } else {
    // Phone-sized patient app at 390x844 @3x (its own context, so the patient's stored visit stays with it).
    pCtx = await ctx.browser().newContext({ viewport: PHONE_VP, deviceScaleFactor: 3, locale: 'en-GB', timezoneId: 'Asia/Bangkok', colorScheme: 'light' });
    await pCtx.addInitScript(() => { try { if (!localStorage.getItem('medx.lang')) localStorage.setItem('medx.lang', 'en'); } catch { /* storage blocked */ } });
    pPage = await pCtx.newPage();
    await pPage.goto(BASE + '/patient/?new=1&lang=en', { waitUntil: 'domcontentloaded' });
    pFrame = pPage.mainFrame();
  }
  await pFrame.getByText('Start', { exact: true }).waitFor({ timeout: 30000 });
  await sleep(400);
  if (!video) await phoneShot(rec, pPage, 'patient-home');
  await pFrame.getByText('Start', { exact: true }).click();
  await pFrame.waitForURL(/\/intake/, { timeout: 30000 });
  const sample = pFrame.getByRole('button', { name: /allergic to penicillin/ });
  await sample.waitFor({ timeout: 30000 });
  await pFrame.getByText('What brings you in today?').first().waitFor();
  await sleep(500);
  const input = pFrame.locator('textarea').first();
  await rec.seg('intake', async () => {
    await pause(600);
    await smoothInto(sample, 'center');
    await pause(250);
    await cue('penicillin');
    await sample.click();
    await pause(200);
    await cue('checks');
    await smoothInto(input, 'start');
    await pause(900);
  });
  if (!video) {
    const q = pFrame.getByText('What brings you in today?').first();
    await snapAt(rec, 'patient-voice', q, (b) => ({ x: 0, y: Math.max(0, b.y - 28), width: 390, height: 390 / 0.8 }), { page: pPage, scroll: false });
    await snap(rec, 's-patient', null, { page: pPage, clip: { x: 0, y: 0, width: 390, height: 844 }, out: { readme: 's-patient.jpg' } });
    await pPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await sleep(300);
    await phoneShot(rec, pPage, 'patient-intake');
  }
  await pFrame.getByText('Send', { exact: true }).click();
  await pFrame.waitForURL(/\/done/, { timeout: 60000 });
  await pFrame.getByText('Your code').first().waitFor({ timeout: 30000 });
  const code = (await pFrame.locator('body').innerText()).match(/Your code\s+(B-\d{3})/)?.[1];
  if (!code) throw new Error('No visit code on the done screen');
  const sess = await sessionByCode(code);
  const id = sess.id;
  log(`new synthetic visit ${code} (${id})`);
  await sleep(600);
  await rec.seg('sent');

  // 3. Nurse: queue (reading needs no sign-in), the "Who's signing in?" sheet on the case, then the evidence highlight
  //    and approval. The other personas are set in localStorage directly (asRole), so their sheet never shows.
  await removeOverlay(page, 'mx-stage');
  await asRoleUnsigned(page, 'nurse');
  const row = page.getByRole('link').filter({ hasText: code }).first();
  await go(page, '/review', row);
  await sleep(500);
  await rowInList(row, 8);
  await rec.seg('queue', async () => {
    await pause(400);
    await cue('lands');
    await row.hover();
    await rec.spot(row, 6);
    await pause(800);
  });
  await rec.unspot();
  await row.click();
  await page.waitForURL(new RegExp(`/review/${id}$`), { timeout: 30000 });
  const allergyRow = page.locator('[data-field-key="allergies"]');
  await allergyRow.waitFor({ timeout: 30000 });
  await page.locator('#transcript').getByText(/sore throat/i).first().waitFor({ timeout: 30000 }).catch(() => {});
  const sheet = page.locator('[data-signin-sheet="nurse"]');
  await sheet.waitFor({ timeout: 20000 });
  await sleep(700); // the sheet's entrance has settled
  const pick = sheet.locator('button[data-staff]').filter({ hasText: STAFF.nurse }).first();
  const accountBtn = page.locator('button[aria-haspopup="menu"]').first();
  // While the bottom sheet is open the caption sits just above it, then glides back down once a name is chosen.
  const sheetBox = await sheet.boundingBox();
  if (sheetBox) STEPS.signin.cap = Math.round(H - sheetBox.y + 12);
  await rec.seg('signin', async () => {
    await pause(400);
    await cue('signs');
    await rec.spot(pick, 4);
    await pause(500);
    await rec.unspot(); // the page column re-mounts (with its fade) once a name is chosen; no ring over it
    await pick.click();
    await sheet.waitFor({ state: 'detached', timeout: 10000 });
    if (!video) return;
    await page.evaluate(() => { const c = document.getElementById('mx-cap'); if (c) { c.style.transition = 'bottom .38s cubic-bezier(.22,1,.36,1)'; c.style.bottom = '14px'; } });
    // The account menu now names the synthetic demo identity.
    await pause(200);
    await cue('every');
    await accountBtn.click();
    await page.getByRole('menu').waitFor({ timeout: 5000 });
    await pause(1100);
  });
  if (video) {
    await page.keyboard.press('Escape');
    await page.getByRole('menu').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  await sleep(300);
  await instantInto(allergyRow, 'center');
  const approveAll = page.getByRole('button', { name: /Approve supported fields/ });
  if (!video) {
    // Consult live summary before approval: every field still marked "From patient's words".
    // Wide (two-column) bento card: the page title, case chips and the full live summary, about 3.2:1.
    await page.setViewportSize({ width: 1180, height: 860 });
    const summaryHead = page.getByRole('heading', { name: 'Live summary' });
    await go(page, `/review/${id}/consult?mode=nurse`, summaryHead);
    await sleep(800);
    const summary = summaryHead.locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
    await snapAt(rec, 'hero-consult', summary, (b) => {
      const width = b.width + 28;
      const height = Math.max(b.height + 36, width / 3.4);
      return { x: b.x - 14, y: b.y - (height - b.height) / 2, width, height };
    }, { top: 60 });
    await page.setViewportSize(STILLS_VP);
    await go(page, `/review/${id}`, allergyRow);
    await sleep(400);
    await instantInto(allergyRow, 'center');
  }
  await rec.seg('evidence', async () => {
    await pause(400);
    await cue('links');
    await allergyRow.click();
    await pause(1800);
    if (!video) {
      await sleep(500);
      await readmeShot(rec, 's-nurse', 's-nurse.png', async () => { await instantInto(allergyRow, 'center'); await allergyRow.click(); });
    }
    await cue('approves');
    await approveAll.click();
    await page.locator('[data-receipt="approved"]').waitFor({ timeout: 30000 });
    await pause(700);
  });

  // 3b. Narrated cut only: the seeded Thai visit MED-01 (seed.ts; stable id from pipeline.ts demoSessionId) in the same
  //     nurse view. Its fields sit beside the patient's own Thai words; read only, nothing on that case changes.
  if (video && STEPS.thai) {
    const h = createHash('sha256').update('medx-demo:MED-01').digest('hex');
    const thId = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
    const ccRow = page.locator('[data-field-key="chief_complaint"]');
    await go(page, `/review/${thId}`, ccRow);
    // The Thai turn's quote-to-field list ("ไอ" -> Chief complaint: cough, ...).
    const quoteList = page.locator('#transcript ul').filter({ hasText: /Chief complaint/ }).first();
    await quoteList.waitFor({ timeout: 30000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await sleep(500);
    await rec.seg('thai', async () => {
      await pause(300);
      await cue('words');
      await ccRow.click(); // highlights its Thai quote in the patient's words
      await pause(400);
      await cue('quote');
      await rec.spot(quoteList, 6);
      await pause(1600);
    });
    await rec.unspot();
  }

  // 4. Vitals and the NEWS2-based suggestion, confirmed by the nurse
  const hr = page.locator('input[name="heartRate"]');
  await go(page, `/review/${id}/vitals`, hr);
  await sleep(400);
  const V = GOLD.nurse.vitals;
  const vitalsIn = [['heartRate', V.heartRate], ['systolicBP', V.systolicBP], ['diastolicBP', V.diastolicBP], ['respRate', V.respRate], ['tempC', V.tempC], ['spo2', V.spo2], ['painScore', V.painScore]];
  const suggestion = page.getByRole('heading', { name: /Suggested triage level/ });
  await rec.seg('vitals', async () => {
    await cue('records');
    for (const [k, v] of vitalsIn) { await page.locator(`input[name="${k}"]`).fill(String(v)); await pause(100); }
    await page.locator('input[name="onOxygen"][value="no"]').check();
    await page.locator('label').filter({ hasText: /^Alert$/ }).click();
    await pause(150);
    await cue('suggests', 0.7); // the suggestion card renders after the save round trip
    await page.getByRole('button', { name: 'Save vitals' }).click();
    await suggestion.waitFor({ timeout: 30000 });
    const card = suggestion.locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
    await pause(250);
    await rec.spot(card, 6);
    await pause(1200);
    await rec.unspot();
    if (video) await clearOfCaption(page, page.getByRole('button', { name: /Confirm level/ }), 'vitals');
    await cue('confirms');
    await page.getByRole('button', { name: /Confirm level/ }).click();
    await page.getByRole('button', { name: 'Ready for doctor' }).waitFor({ timeout: 30000 });
    await pause(400);
  });
  if (!video) {
    const card = suggestion.locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
    await snapAt(rec, 'nurse-case', card, (b) => ({ x: b.x - 10, y: b.y - 10, width: b.width + 20, height: (b.width + 20) / 1.33 }));
  }

  // 5. Doctor: consult considerations, then the signed note
  await asRole(page, 'doctor', STAFF.doctor);
  await page.getByRole('button', { name: 'Ready for doctor' }).click();
  await page.waitForURL(/\/consult\?mode=doctor/, { timeout: 30000 });
  const consHead = page.getByRole('heading', { name: 'Considerations' });
  await consHead.waitFor({ timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  const consCard = consHead.locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  const keep = consCard.getByRole('button', { name: 'Keep in note' }).first();
  await keep.waitFor({ timeout: 30000 });
  await instantInto(consCard, 'center');
  await sleep(300);
  await rec.seg('consider', async () => {
    await pause(500);
    await cue('considerations');
    await rec.spot(consCard, 4);
    await pause(450);
    await cue('keeps');
    await keep.click();
    await consCard.getByRole('button', { name: 'Kept in note' }).first().waitFor({ timeout: 20000 });
    await pause(800);
  });
  // Off camera: draft the note and resolve each unsupported line with the doctor's explicit wording.
  await page.getByRole('button', { name: 'Draft note' }).click();
  const noteHead = page.getByRole('heading', { name: 'Draft visit note' });
  const signBtn = page.getByRole('button', { name: 'Sign note' });
  await signBtn.waitFor({ timeout: 60000 });
  for (let i = 0; i < 20; i++) {
    const line = page.locator('section:not([aria-labelledby="ns-open_questions"]) li:has(.mx-pencil)').first();
    if (!(await line.count())) break;
    await line.getByRole('button', { name: 'Edit' }).click();
    await line.locator('input').fill(NOT_ASSESSED);
    await line.getByRole('button', { name: 'Save' }).click();
    await sleep(150);
  }
  // The doctor signs (off camera: signing moves focus to the consult input, which scrolls the page); the step then
  // shows the signed receipt and the kept consideration inside the signed note.
  await signBtn.click();
  const signedHead = page.getByRole('heading', { name: 'Signed visit note' });
  await signedHead.waitFor({ timeout: 30000 });
  // After signing, the consult transcript scrolls its last line into view (smooth) once the session reloads, which
  // pulls the window up a second or two later. Wait that out, then hold the signed note at the top until it stays put.
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await sleep(1500);
  // Signing leaves focus in the consult's "Type what was said" input; any scroll then pulls the page back to it.
  // Drop that focus (no state change) so the signed note stays in view.
  const focused = await page.evaluate(() => { const a = document.activeElement; const d = a ? `${a.tagName.toLowerCase()} ${a.getAttribute('aria-label') || a.getAttribute('name') || a.id || ''}`.trim() : ''; a?.blur?.(); return d; });
  if (DEBUG) log(`focus after signing: ${focused || 'none'} (blurred)`);
  const receipt = page.getByText('Note signed', { exact: true }).first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  // The receipt near the top leaves the note body, down to the kept consideration, above the caption bar.
  await settleAt((await receipt.count()) ? receipt : signedHead, 14, 4);
  await rec.seg('signed', async () => {
    await pause(600);
    await cue('signs');
    if (await receipt.count()) await rec.spot(receipt, 4);
    await pause(1200);
  });
  if (!video) {
    // A fresh load of the consult: in the page that just signed, any scroll pulls the window back to the transcript.
    await go(page, `/review/${id}/consult?mode=doctor`, signedHead);
    await sleep(1500);
    const signedCard = page.getByRole('heading', { name: 'Signed visit note' }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
    await snapAt(rec, 'consult', signedCard, (b) => ({ x: b.x - 10, y: b.y - 10, width: 470, height: 470 / 1.33 }));
  }

  // 6. Orders: deterministic allergy alert with options for prescriber review
  // "Write orders" is a client-side link; a full load keeps the page's scroll under the recorder's control.
  const drug = page.locator('input[name="drugText"]');
  await go(page, `/review/${id}/orders`, drug);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await sleep(300);
  const rx = GOLD.doctor.order;
  const fillRx = async (o) => {
    for (const k of ['drugText', 'dose', 'route', 'frequency', 'duration']) { await page.locator(`input[name="${k}"]`).fill(o[k]); await pause(90); }
  };
  const prescribing = page.getByRole('heading', { name: 'Prescribing' }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  const alertTitle = page.getByText('Allergy conflict').first();
  await rec.seg('order', async () => {
    await pause(300);
    await cue('orders');
    await fillRx(rx);
    if (!video) return;
    await cue('check', 0.35);
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await alertTitle.waitFor({ timeout: 30000 });
    await pause(500);
    const options = page.getByText('Options to review').first();
    await smoothInto(options, 'center');
    const alertCard = alertTitle.locator('xpath=ancestor::li[1]');
    await rec.spot((await alertCard.count()) ? alertCard : options, 4);
    await pause(1400);
  });
  if (!video) {
    const checkBtn = page.getByRole('button', { name: 'Check', exact: true });
    await scrollAnchor(page, prescribing, 90);
    const cb = await checkBtn.boundingBox();
    await snapAt(rec, 'orders', prescribing, (b) => {
      const width = b.width + 20;
      const height = width / 1.25;
      return { x: b.x - 10, y: Math.max(b.y - 10, cb.y + cb.height + 18 - height), width, height };
    }, { scroll: false });
    await readmeShot(rec, 's-doctor', 's-doctor.png', async () => {
      await checkBtn.click();
      await alertTitle.waitFor({ timeout: 30000 });
      await sleep(900);
      await instantInto(page.getByText('Options to review').first(), 'center');
    });
  }
  await page.getByLabel('Reason for proceeding despite this alert').first().fill(GOLD.doctor.overrideReason);
  await page.getByRole('button', { name: 'Submit to pharmacy' }).click();
  await page.getByRole('button', { name: 'Submit to pharmacy' }).waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await sleep(400);

  // 7. Pharmacist 1 returns it with a report and an option for prescriber review
  await asRole(page, 'pharmacist', STAFF.p1);
  const returnBtn = page.getByRole('button', { name: 'Return to prescriber' });
  await go(page, `/pharmacy/${id}`, returnBtn);
  await sleep(400);
  const optionsHead = page.getByText('Options for prescriber review').first();
  await instantInto(optionsHead, 'center');
  await sleep(300);
  await rec.seg('ret', async () => {
    await pause(600);
    await cue('returns');
    await returnBtn.click();
    const note = page.getByLabel(/Note to the prescriber/);
    await note.waitFor({ timeout: 10000 });
    await note.fill(GOLD.pharmacist1.returnNote);
    const suggest = page.locator('form').getByLabel(new RegExp(`^${GOLD.pharmacist1.suggestedGenerics[0]}`)).first();
    await smoothInto(suggest, 'center');
    await cue('suggesting');
    for (const g of GOLD.pharmacist1.suggestedGenerics) await page.locator('form').getByLabel(new RegExp(`^${g}`)).first().check();
    await pause(350);
    if (!video) return;
    await clearOfCaption(page, page.getByRole('button', { name: 'Return with report' }), 'ret');
    await cue('review');
    await page.getByRole('button', { name: 'Return with report' }).click();
    await page.getByRole('button', { name: 'Return with report' }).waitFor({ state: 'detached', timeout: 30000 });
    await pause(250);
  });
  if (!video) {
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Return with report' }) }).first();
    const legend = form.locator('legend').last();
    await scrollAnchor(page, legend, 110);
    const fb = await form.boundingBox();
    await snapAt(rec, 'pharmacy-verify', legend, (b) => ({ x: fb.x - 10, y: b.y - 18, width: 470, height: 470 / 1.33 }), { scroll: false });
    await readmeShot(rec, 's-pharmacist', 's-pharmacist.png', async () => { await scrollAnchor(page, page.getByLabel(/Note to the prescriber/), 260); });
    await page.getByRole('button', { name: 'Return with report' }).click();
    await page.getByRole('button', { name: 'Return with report' }).waitFor({ state: 'detached', timeout: 30000 });
  }

  // 8. Doctor resubmits the option they chose
  await asRole(page, 'doctor', STAFF.doctor);
  const alt = GOLD.doctor.reorder;
  const useAlt = page.getByRole('button', { name: new RegExp(`Edit with ${alt.drugText}`) }).first();
  await go(page, `/review/${id}/orders`, useAlt);
  await sleep(300);
  const report = page.getByText('Pharmacist report').first();
  if (await report.count()) await instantInto(report, 'start');
  await page.evaluate(() => window.scrollBy(0, -90));
  await sleep(300);
  await rec.seg('resubmit', async () => {
    await pause(400);
    if (await report.count()) await rec.spot(report.locator('xpath=ancestor::section[1]'), 4);
    await pause(500);
    await rec.unspot();
    await cue('changes');
    await useAlt.click();
    const update = page.getByRole('button', { name: 'Update and re-check' });
    await update.waitFor();
    await fillRx(alt);
    // Keep the button above the caption bar (measured after filling: the "Option under review" box renders late and
    // pushes the form down).
    if (video) await clearOfCaption(page, update, 'resubmit');
    await cue('resubmits');
    await update.click();
    const submit = page.getByRole('button', { name: 'Submit to pharmacy' });
    await submit.waitFor({ timeout: 30000 });
    await pause(200);
    await submit.click();
    await submit.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    await pause(200);
  });

  // 9. Pharmacist 1 verifies
  await asRole(page, 'pharmacist', STAFF.p1);
  const verifyBtn = page.getByRole('button', { name: 'Verify', exact: true }).first();
  await go(page, `/pharmacy/${id}`, verifyBtn);
  await instantInto(verifyBtn, 'center');
  await sleep(300);
  const verified = page.getByText('Order verified').first();
  await rec.seg('verify', async () => {
    await pause(500);
    await cue('verifies');
    await verifyBtn.click();
    await verified.waitFor({ timeout: 30000 });
    // Bring the verified receipt and the stage-2 block above the caption bar.
    await verified.evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150, behavior: 'smooth' }));
    await pause(700);
  });

  // 10. Pharmacist 2: the two-person block (the verifier is still signed in), then the switch to the second
  //     pharmacist on camera, then the six-item check
  const block = page.getByText('A second pharmacist must dispense').first();
  await block.waitFor({ timeout: 30000 });
  const blockBox = await block.locator('xpath=ancestor::*[@role="status"][1]').boundingBox();
  if (!blockBox || blockBox.y < 60 || blockBox.y + blockBox.height > H - 150) await settleAt(block, 260);
  await sleep(200);
  const switchBtn = page.getByRole('button', { name: `Sign in as ${STAFF.p2}` });
  const fieldset = page.locator('fieldset').filter({ hasText: 'Six-item final check' }).first();
  await rec.seg('block', async () => {
    await pause(250);
    await cue('whoever');
    await rec.spot(block.locator('xpath=ancestor::*[@role="status"][1]'), 4);
    await pause(1100);
    await rec.unspot();
    await cue('second');
    await switchBtn.click();
    await fieldset.waitFor({ timeout: 20000 });
    await pause(500);
  });
  await rec.unspot();
  if (!(await fieldset.isVisible())) { await switchBtn.click(); await fieldset.waitFor({ timeout: 20000 }); }
  // The check from its top: all six rows above the caption bar (the dispense button is cleared before its click).
  if (video) await settleAt(fieldset, 70, 2);
  else await instantInto(fieldset, 'center');
  await sleep(300);
  const boxes = fieldset.locator('input[type="checkbox"]');
  const dispensed = page.getByText(new RegExp(`^Dispensed by ${STAFF.p2}`)).first();
  await rec.seg('dispense', async () => {
    await pause(250);
    await cue('ticks');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) { await boxes.nth(i).check(); await pause(130); }
    await pause(200);
    if (!video) return;
    await clearOfCaption(page, page.getByRole('button', { name: 'Record final check and dispense' }), 'dispense');
    await cue('dispensing');
    await page.getByRole('button', { name: 'Record final check and dispense' }).click();
    await page.getByRole('button', { name: 'Record final check and dispense' }).waitFor({ state: 'detached', timeout: 30000 });
    // Show the dispense receipt (the page reflows once the check is recorded).
    await dispensed.waitFor({ timeout: 30000 });
    await dispensed.evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 200, behavior: 'smooth' }));
    await pause(600);
  });
  if (!video) {
    await snapAt(rec, 'pharmacy-dispense', fieldset.locator('legend').first(), (b) => ({ x: b.x - 14, y: b.y - 16, width: 470, height: 470 / 1.33 }), { top: 110 });
    await page.getByRole('button', { name: 'Record final check and dispense' }).click();
    await page.getByRole('button', { name: 'Record final check and dispense' }).waitFor({ state: 'detached', timeout: 30000 });
  }

  // 11. Call the patient to counter 2
  const callBtn = page.getByRole('button', { name: 'Call patient' });
  await callBtn.waitFor({ timeout: 30000 });
  await instantInto(callBtn, 'center');
  await sleep(250);
  const counter = `Counter ${GOLD.pharmacist2.counter}`;
  await rec.seg('call', async () => {
    await pause(300);
    await cue('call', 0.5);
    await page.getByRole('radio', { name: counter }).or(page.getByRole('button', { name: counter, exact: true })).first().click();
    await pause(250);
    await callBtn.click();
    await page.getByRole('button', { name: 'Call again' }).or(page.getByText(/called/i)).first().waitFor({ timeout: 30000 });
    await pause(350);
  });

  // 12. Patient phone: ready at counter 2
  if (video) {
    await setOverlay(page, 'mx-stage', phoneStageHtml({ src: '/patient/', eyebrow: 'Patient app', a: 'Ready at', b: `counter ${GOLD.pharmacist2.counter}.`, sub: 'The phone shows the visit code and the counter. Never drug names, staff or notes.' }));
    const handle = await page.waitForSelector('#mx-stage iframe');
    pFrame = await handle.contentFrame();
  } else {
    await pPage.goto(BASE + '/patient/', { waitUntil: 'domcontentloaded' });
    pFrame = pPage.mainFrame();
  }
  await pFrame.getByText(new RegExp(`counter ${GOLD.pharmacist2.counter}`, 'i')).first().waitFor({ timeout: 30000 });
  await sleep(900);
  await rec.seg('ready');
  if (!video) {
    // Starts at the pharmacy card, below the code hero, so Fin is not in the crop (DIRECTION 12.5: no Fin in the bento).
    await snapAt(rec, 'patient-pickup', pFrame.getByText('Pharmacy', { exact: true }).first(), (b) => ({ x: 0, y: b.y - 34, width: 390, height: 300 }), { page: pPage, scroll: false });
    // The whole ready screen for device mockups. Its own name: patient-pickup.webp stays the bento crop above.
    await phoneShot(rec, pPage, 'patient-pickup-phone');
  }

  // 13. Ops dashboard
  await removeOverlay(page, 'mx-stage');
  await asRole(page, 'ops', STAFF.ops);
  const flow = page.getByRole('heading', { name: 'Pharmacy flow' });
  await go(page, '/ops', flow);
  await sleep(600);
  await rec.seg('ops', async () => {
    await pause(600);
    await cue('each');
    await smoothInto(flow, 'start');
    await page.evaluate(() => window.scrollBy({ top: -20, behavior: 'instant' }));
    await pause(800);
  });
  if (!video) {
    // Pharmacy flow heading and its first two stage tiles (no red: the escalation count stays out of the crop).
    await page.setViewportSize({ width: 1440, height: 900 });
    await sleep(600);
    const t2 = page.getByText('To dispense', { exact: true }).first();
    await scrollAnchor(page, flow, 100);
    // Tiles are equal width (CSS modules, no utility classes to anchor on): tile 2's right edge from the label pitch.
    const l1 = await page.getByText('To verify', { exact: true }).first().boundingBox();
    const l2 = await t2.boundingBox();
    await snapAt(rec, 'ops', flow, (b) => {
      const right = l1 && l2 ? l2.x + (l2.x - l1.x) - 57 + 6 : b.x + 520;
      const width = right - (b.x - 22);
      return { x: b.x - 22, y: b.y - 18, width, height: width / 1.6 };
    }, { scroll: false });
    await page.setViewportSize(STILLS_VP);
    await sleep(400);
  }

  // 14. Case trace
  await asRole(page, 'doctor', STAFF.doctor);
  const traceHead = page.getByRole('heading', { name: /Case trace/ }).first();
  await go(page, `/review/${id}/trace`, traceHead);
  await sleep(800);
  await rec.seg('trace', async () => {
    await pause(600);
    if (NARR) {
      // The line names the red-flag rules: ring that node while it is said, then let go before the scroll.
      await cue('red-flag', 0.3);
      const rf = page.locator('button[data-node]').filter({ has: page.getByText('Red-flag rules', { exact: true }) }).first();
      if (await rf.count()) await rec.spot(rf, 6);
      await cue('then', 0.5);
      await rec.unspot();
    }
    // Scroll the graph horizontally to show the later human and pharmacy steps.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find((n) => n.scrollWidth > n.clientWidth + 40 && getComputedStyle(n).overflowX !== 'visible' && n.clientHeight > 100);
      if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    });
    await pause(1600);
  });
  if (!video) {
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find((n) => n.scrollWidth > n.clientWidth + 40 && getComputedStyle(n).overflowX !== 'visible' && n.clientHeight > 100);
      if (el) el.scrollTo({ left: 0, behavior: 'instant' });
    });
    await sleep(400);
    if (DEBUG) await page.screenshot({ path: path.join(WORK, 'dbg-trace-full.png'), fullPage: true });
    // Rules before the model, then the evidence check: patient turn -> redact -> red-flag rules -> model -> verify.
    const box = (t) => page.getByText(t).first().boundingBox().catch(() => null);
    const a = await box(/^Patient turn$/);
    const zb = await box(/^Verify against/);
    const m1 = await box(/^Model red-flag/);
    const m2 = await box(/^Model extraction$/);
    if (a && zb && m1 && m2) {
      const x = a.x - 26;
      const width = zb.x + zb.width + 26 - x;
      const top = m1.y - 34;
      const bottom = m2.y + m2.height + 40;
      const height = Math.max(bottom - top, width / 4.2);
      await snap(rec, 'trace', null, { clip: { x, y: top - (height - (bottom - top)) / 2, width, height } });
    } else log('warning: trace nodes not found; trace still not captured');
  }

  // 15. Closing card
  if (video) await setOverlay(page, 'mx-stage', closingHtml());
  await rec.seg('closing');
  await removeOverlay(page, 'mx-cap');
  await sleep(400); // the closing card stays up until the recording ends
  if (pCtx) await pCtx.close();
  return { code, id };
}

// ---------- Video assembly ----------
const MARK_BOX = { x: W - 4 - 8, y: H - 4 - 8, size: 8 }; // where Recorder.seg draws the step marker
/** Per frame (at FPS) of the raw recording: 'm' (magenta marker), 'g' (green marker) or '.' (no marker). */
function markerTrack(raw) {
  const inner = MARK_BOX.size - 4;
  const r = ff(['-i', raw, '-vf', `fps=${FPS},crop=${inner}:${inner}:${MARK_BOX.x + 2}:${MARK_BOX.y + 2},scale=1:1:flags=area,format=rgb24`, '-f', 'rawvideo', '-'], { binary: true });
  const buf = r.stdout;
  let out = '';
  for (let i = 0; i + 2 < buf.length; i += 3) {
    const [R, G, B] = [buf[i], buf[i + 1], buf[i + 2]];
    out += R > 170 && G < 100 && B > 170 ? 'm' : G > 170 && R < 100 && B < 120 ? 'g' : '.';
  }
  return out;
}
/** Runs of marker frames, in order; runs shorter than 3 frames are noise. */
function markerRuns(track) {
  const runs = [];
  const re = /m+|g+/g;
  let m;
  while ((m = re.exec(track))) if (m[0].length >= 3) runs.push({ c: m[0][0], from: m.index, frames: m[0].length });
  return runs;
}

function assemble(rec, raw) {
  const track = markerTrack(raw);
  const runs = markerRuns(track).slice(0, rec.segs.length);
  if (runs.length !== rec.segs.length) throw new Error(`found ${runs.length} marked steps in the recording, expected ${rec.segs.length}`);
  runs.forEach((r, i) => { if (r.c !== (i % 2 ? 'g' : 'm')) throw new Error(`step ${rec.segs[i].id}: marker colour out of order`); });
  log(`markers: ${runs.length} steps found in ${track.length} frames`);

  const parts = rec.segs.map((s, i) => {
    const budget = STEPS[s.id].t;
    const from = runs[i].from + 1; // skip the first marked frame (paint settles)
    const frames = runs[i].frames - 1;
    const real = frames / FPS;
    // With narration a short overrun loses its tail instead of being sped up, so the step keeps time with its line.
    const speed = real > budget + (NARR ? MAX_OVERRUN : 0.3) ? Math.min(MAX_SPEED, real / budget) : 1;
    if (real / budget > MAX_SPEED + 0.01) log(`warning: step ${s.id} ran ${(real / budget).toFixed(2)}x its budget; capped at ${MAX_SPEED}x`);
    const useFrames = Math.min(frames, Math.round(budget * speed * FPS));
    const out = useFrames / FPS / speed;
    const pad = Math.max(0, budget - out); // a step that came out short holds its last frame
    return { id: s.id, from, useFrames, speed, pad, out: out + pad, real };
  });
  fs.writeFileSync(path.join(WORK, 'timeline.json'), JSON.stringify({ raw, runs, segs: rec.segs, parts, cueLog: rec.cueLog }, null, 1));
  // Normalise to constant FPS first, so frame numbers match the marker track exactly.
  let filter = `[0:v]fps=${FPS},split=${parts.length}${parts.map((_, i) => `[r${i}]`).join('')};`;
  parts.forEach((p, i) => {
    const pad = p.pad > 0.02 ? `,tpad=stop_mode=clone:stop_duration=${p.pad.toFixed(3)}` : '';
    filter += `[r${i}]trim=start_frame=${p.from}:end_frame=${p.from + p.useFrames},setpts=(PTS-STARTPTS)/${p.speed.toFixed(4)},fps=${FPS}${pad},format=yuv420p[s${i}];`;
  });
  // Cross-fade chain.
  let last = 's0';
  let acc = parts[0].out;
  const cues = [{ id: parts[0].id, start: 0 }];
  for (let i = 1; i < parts.length; i++) {
    const offset = acc - FADE;
    const outLabel = i === parts.length - 1 ? 'vx' : `x${i}`;
    filter += `[${last}][s${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[${outLabel}];`;
    cues.push({ id: parts[i].id, start: offset });
    last = outLabel;
    acc = offset + parts[i].out;
  }
  // Paint out the step marker (bottom-right corner) from neighbouring pixels.
  filter += `[vx]delogo=x=${MARK_BOX.x - 3}:y=${MARK_BOX.y - 3}:w=${MARK_BOX.size + 6}:h=${MARK_BOX.size + 6}[vout]`;
  const total = acc;
  log(`assembled length ${total.toFixed(2)} s from ${parts.length} steps`);
  const [lo, hi] = lengthWindow();
  if (total < lo || total > hi) throw new Error(`Video would be ${total.toFixed(2)} s; adjust STEPS budgets (${lo.toFixed(2)}..${hi.toFixed(2)} s required)`);

  ensureDir(OUT_MEDIA);
  const mp4 = path.join(OUT_MEDIA, `${NAME}.mp4`);
  const title = NARR ? 'MedX walkthrough, narrated (synthetic demo)' : 'MedX in 60 seconds (synthetic demo)';
  const silent = NARR ? path.join(WORK, 'video-silent.mp4') : mp4;
  const filterFile = path.join(WORK, 'filter.txt');
  fs.writeFileSync(filterFile, filter);
  ff(['-i', raw, '-filter_complex_script', filterFile, '-map', '[vout]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-tune', 'stillimage', '-r', String(FPS), '-movflags', '+faststart', '-metadata', `title=${title}`, silent]);
  const audio = NARR ? narrationTrack(cues, total, silent, mp4, title) : null;

  // Poster: a real frame of the video (the title card, after its entrance settles).
  const poster = path.join(OUT_MEDIA, `${NAME}-poster.jpg`);
  ff(['-ss', '2.2', '-i', mp4, '-frames:v', '1', '-q:v', '3', poster]);

  // Captions (WebVTT), one cue per step with its real timing in the finished video (with narration: the narration
  // text, one cue per sentence, at the times it is spoken).
  const vtt = ['WEBVTT', '', `NOTE ${NARR ? 'MedX walkthrough, narrated' : 'MedX in 60 seconds'}. Synthetic data only. Generated by scripts/record-demo.mjs.`, ''];
  const cueText = {
    title: 'MedX. Every word, understood. Multilingual pre-visit intake; Fin listens while nurses, doctors and pharmacists decide.',
    closing: 'Research prototype. Synthetic data. Clinicians decide. MedX supports clinicians; it does not diagnose, prescribe or decide urgency. Not a medical device.',
  };
  const stepCue = (c, i) => {
    const begin = i === 0 ? 0 : c.start + FADE / 2;
    const end = i + 1 < cues.length ? cues[i + 1].start + FADE / 2 : total;
    const s = STEPS[c.id];
    return { id: c.id, begin, end, text: cueText[c.id] || `${s.who}: ${s.text}.` };
  };
  const vttCues = NARR ? narrationCaptions(cues, total, stepCue) : cues.map(stepCue);
  vttCues.forEach((c, i) => vtt.push(String(i + 1), `${vttTime(c.begin)} --> ${vttTime(c.end)} ${cueSettings(c.id)}`, c.text, ''));
  fs.writeFileSync(path.join(OUT_MEDIA, `${NAME}.en.vtt`), vtt.join('\n'));

  const dur = mediaDuration(mp4);
  const size = fs.statSync(mp4).size;
  const probe = String(ff(['-i', mp4], { allowFail: true }).stderr);
  const vline = (probe.match(/Stream #0:\d.*Video: .*/) || [''])[0].trim();
  const aline = (probe.match(/Stream #0:\d.*Audio: .*/) || [''])[0].trim();
  const faststart = (() => { const b = fs.readFileSync(mp4); return b.indexOf('moov') < b.indexOf('mdat'); })();
  return { mp4, poster, duration: dur, bytes: size, stream: vline, audioStream: aline || null, faststart, parts, cues, total, audio, captions: vttCues.length };
}

/**
 * WebVTT cue settings that keep a caption cue above step `id`'s burned-in caption bar (Recorder.caption: about 44 px
 * tall, `cap` px above the bottom edge; 14 px by default). Without them a player draws the cue at the bottom, right on
 * the bar, whenever its controls are hidden, and neither can be read. `line:<p>%` puts the cue box's TOP edge at p% of
 * the frame height (line alignment "start": Chromium ignores an ",end" alignment, so none is used). The box is one
 * caption line, about 44 px at 720p in Chromium/Edge (measured), and splitCaption keeps cues to one line; 10 px of air
 * stays above the bar. The bar-less title and closing cards use the default bar position.
 */
const CUE_BOX = 46;
function cueSettings(id) {
  const cap = STEPS[id]?.cap ?? 14;
  const top = H - cap - 44 - 10 - CUE_BOX;
  return `line:${(Math.floor((top / H) * 1000) / 10).toFixed(1)}% align:center`;
}

const vttTime = (t) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};

// ---------- Narration track ----------
/** Where each narrated step's line plays in the finished cut: its step's start (from the cross-fade chain) + lead. */
function narrationPlacements(cues) {
  return cues.filter((c) => NARR.lines[c.id]).map((c) => {
    const l = NARR.lines[c.id];
    return { id: c.id, wav: l.wav, sec: l.sec, at: c.start + narrLead(c.id) };
  });
}

/** Integrated loudness, loudness range and true peak of a file's first audio stream (ffmpeg ebur128, BS.1770). */
function loudness(file) {
  const r = ff(['-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const s = String(r.stderr);
  const sum = s.slice(s.lastIndexOf('Summary:'));
  const num = (re) => { const m = sum.match(re); return m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : NaN; };
  return { lufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDbtp: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}

/**
 * Builds the narration track and muxes it with the silent cut: every line at its step's start, an optional bed
 * (looped if short, faded in and out) levelled so it sits at --bed-lufs in the finished mix, the sum brought to
 * TARGET_LUFS with a true-peak limiter (4x oversampled) at LIMIT_DBTP, then AAC 192 kb/s. The encoded file is
 * measured again and must stay below -1 dBTP.
 */
function narrationTrack(cues, total, silent, mp4, title) {
  const place = narrationPlacements(cues);
  for (let k = 0; k < place.length; k++) {
    const p = place[k];
    const next = k + 1 < place.length ? place[k + 1].at : total;
    if (p.at + p.sec > next + 0.005) throw new Error(`narration: the ${p.id} line (${p.sec.toFixed(2)} s at ${p.at.toFixed(2)} s) runs into the next line or the end`);
  }
  const D = total.toFixed(3);
  const inputs = [];
  let fc = '';
  place.forEach((p, k) => {
    inputs.push('-i', p.wav);
    fc += `[${k}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,adelay=delays=${Math.round(p.at * 48000)}S:all=1[v${k}];`;
  });
  fc += `${place.map((_, k) => `[v${k}]`).join('')}amix=inputs=${place.length}:normalize=0:dropout_transition=0:duration=longest,apad=whole_dur=${D},atrim=0:${D},pan=stereo|c0=c0|c1=c0[voice]`;
  const fcFile = path.join(WORK, 'audio-filter.txt');
  fs.writeFileSync(fcFile, fc);
  const voice = path.join(WORK, 'narration-voice.wav');
  ff([...inputs, '-filter_complex_script', fcFile, '-map', '[voice]', '-c:a', 'pcm_f32le', '-ar', '48000', voice]);
  const voiceOnly = loudness(voice);
  const mix = path.join(WORK, 'narration-mix.wav');
  let bed = null;
  if (BED) {
    if (!fs.existsSync(BED)) throw new Error(`--bed ${BED} not found`);
    const own = loudness(BED).lufs;
    // The master gain the voice will need is known now, so the bed lands at BED_LUFS in the finished mix.
    const gain = BED_LUFS - (TARGET_LUFS - voiceOnly.lufs) - own;
    const fadeOut = Math.min(3, total / 4);
    const fcBed = `[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${D},asetpts=PTS-STARTPTS,volume=${gain.toFixed(2)}dB,`
      + `afade=t=in:st=0:d=1.5,afade=t=out:st=${(total - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}[bed];[0:a][bed]amix=inputs=2:normalize=0:duration=first[mix]`;
    ff(['-i', voice, '-stream_loop', '-1', '-i', BED, '-filter_complex', fcBed, '-map', '[mix]', '-c:a', 'pcm_f32le', '-ar', '48000', mix]);
    bed = { file: BED, ownLufs: own, gainDb: Number(gain.toFixed(2)), targetLufsInMix: BED_LUFS };
  } else fs.copyFileSync(voice, mix);
  const pre = loudness(mix);
  const master = path.join(WORK, 'narration-master.wav');
  let gain = TARGET_LUFS - pre.lufs;
  let ceiling = LIMIT_DBTP;
  let final;
  for (let pass = 1; pass <= 4; pass++) {
    const lim = Math.pow(10, ceiling / 20).toFixed(4);
    ff(['-i', mix, '-af', `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=${lim}:attack=5:release=80:level=0:latency=1,aresample=48000`, '-c:a', 'pcm_f32le', master]);
    ff(['-i', silent, '-i', master, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', '-metadata', `title=${title}`, mp4]);
    final = loudness(mp4);
    log(`audio pass ${pass}: gain ${gain.toFixed(2)} dB, ceiling ${ceiling} dB -> ${final.lufs} LUFS, true peak ${final.truePeakDbtp} dBTP (AAC)`);
    const okPeak = final.truePeakDbtp < -1.0;
    const okLufs = Math.abs(final.lufs - TARGET_LUFS) <= 0.3;
    if (okPeak && okLufs) break;
    if (!okLufs) gain += TARGET_LUFS - final.lufs;
    if (!okPeak) ceiling -= 0.5;
    if (pass === 4) throw new Error(`narration master missed its target: ${final.lufs} LUFS, ${final.truePeakDbtp} dBTP`);
  }
  // The bed's level in the finished mix: its own loudness + its gain + the master gain (the limiter only touches voice peaks).
  if (bed) bed.inMixLufs = Number((bed.ownLufs + bed.gainDb + gain).toFixed(1));
  fs.writeFileSync(path.join(WORK, 'narration.json'), JSON.stringify({ place, bed, voiceOnly, pre, final }, null, 1));
  return { lines: place.map((p) => ({ id: p.id, at: Number(p.at.toFixed(3)), sec: Number(p.sec.toFixed(3)), end: Number((p.at + p.sec).toFixed(3)) })), bed, premaster: pre, final, gainDb: Number(gain.toFixed(2)), ceilingDb: ceiling };
}

/**
 * Narration captions: each line split into sentences (merged up to about two caption lines), each cue starting
 * when its first word is spoken (from the line's word timings when there are any, else by character share) and
 * ending when the next one starts or shortly after the line ends.
 */
function narrationCaptions(cues, total, stepCue) {
  const place = Object.fromEntries(narrationPlacements(cues).map((p) => [p.id, p]));
  const norm = (w) => String(w).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  const out = [];
  cues.forEach((c, i) => {
    const l = NARR.lines[c.id];
    if (!l) { out.push(stepCue(c, i)); return; }
    const p = place[c.id];
    const nextAt = i + 1 < cues.length ? (place[cues[i + 1].id]?.at ?? cues[i + 1].start + FADE / 2) : total;
    const chunks = splitCaption(l.text);
    const words = l.text.split(/\s+/).filter(Boolean);
    const asr = l.words;
    let w = 0;
    let chars = 0;
    const starts = chunks.map((text, k) => {
      const w0 = w;
      const c0 = chars;
      w += text.split(/\s+/).filter(Boolean).length;
      chars += text.length + 1;
      if (k === 0) return 0;
      if (!asr.length) return (c0 / l.text.length) * l.sec;
      // The ASR word at the same share of the line, moved to the nearest word that matches the chunk's first word.
      const guess = Math.min(asr.length - 1, Math.round((w0 * asr.length) / words.length));
      const first = norm(words[w0]);
      let best = guess;
      for (let d = 0; d <= 3; d++) {
        if (asr[guess - d] && norm(asr[guess - d].w) === first) { best = guess - d; break; }
        if (asr[guess + d] && norm(asr[guess + d].w) === first) { best = guess + d; break; }
      }
      return Math.max(0, Math.min(l.sec - 0.3, asr[best].s));
    });
    chunks.forEach((text, k) => {
      const begin = p.at + starts[k];
      const end = k + 1 < chunks.length ? p.at + starts[k + 1] : Math.min(p.at + l.sec + 0.4, nextAt - 0.05, total);
      out.push({ id: c.id, begin, end, text });
    });
  });
  return out;
}
/**
 * Splits a narration line into caption cues: whole sentences, merged while they fit `max` characters. 64 characters
 * stay on one caption line at 16:9 in Chromium/Edge (about 16 px per character at 720p), which cueSettings relies on.
 */
function splitCaption(text, max = 64) {
  const sentences = (text.match(/[^.!?]+(?:[.!?]+["”’)]*)?(?:\s+|$)/g) || [text]).map((s) => s.trim()).filter(Boolean);
  const merged = [];
  for (const s of sentences) {
    const last = merged[merged.length - 1];
    if (last && last.length + 1 + s.length <= max) merged[merged.length - 1] = `${last} ${s}`;
    else merged.push(s);
  }
  // A sentence still too long splits at the comma, semicolon or colon nearest its middle, again while a part is too long.
  const split = (s) => {
    if (s.length <= max) return [s];
    const marks = [...s.matchAll(/[,;:] /g)].map((m) => m.index + 1);
    if (!marks.length) return [s];
    const cut = marks.reduce((a, b) => (Math.abs(b - s.length / 2) < Math.abs(a - s.length / 2) ? b : a));
    return [...split(s.slice(0, cut).trim()), ...split(s.slice(cut).trim())];
  };
  return merged.flatMap(split);
}

// ---------- Stills post-processing ----------
/** Aspect range (w/h) each bento card accepts (apps/web/app/_landing/Features.tsx SPECS). */
const STILL_RANGES = {
  'patient-voice': [0.75, 1], 'hero-consult': [2, 3.4], 'nurse-case': [1.2, 1.5], consult: [1.2, 1.5], orders: [1.2, 1.5],
  'pharmacy-verify': [1.2, 1.5], 'pharmacy-dispense': [1.2, 1.5], 'patient-pickup': [1.2, 1.5], ops: [1.2, 1.9], trace: [2.6, 4.4],
  // Full phone screens (390x844) for device mockups.
  'patient-home': [0.45, 0.47], 'patient-intake': [0.45, 0.47], 'patient-pickup-phone': [0.45, 0.47],
};
function writeStills() {
  ensureDir(OUT_LANDING);
  const out = [];
  const bad = stillsQueue.filter((s) => STILL_RANGES[s.name] && !(s.aspect >= STILL_RANGES[s.name][0] - 0.01 && s.aspect <= STILL_RANGES[s.name][1] + 0.01));
  if (bad.length) throw new Error(`stills outside their card's aspect range: ${bad.map((s) => `${s.name} ${s.aspect.toFixed(2)}`).join(', ')}`);
  for (const s of stillsQueue) {
    if (s.readme) {
      const dest = path.join(OUT_README, s.readme);
      if (s.readme.endsWith('.jpg')) ff(['-i', s.file, '-vf', 'scale=780:-2:flags=lanczos', '-q:v', '4', dest]);
      else {
        // Full-colour copy for the composite (journey.png); the README folder keeps a 256-colour PNG (about 60% smaller).
        const full = path.join(WORK, 'readme-full', s.readme);
        ensureDir(path.dirname(full));
        ff(['-i', s.file, '-vf', 'scale=1280:-2:flags=lanczos', '-compression_level', '9', full]);
        ff(['-i', full, '-vf', 'split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a', '-compression_level', '9', dest]);
      }
      out.push({ name: s.readme, bytes: fs.statSync(dest).size });
      continue;
    }
    if (s.skip) continue;
    const dest = path.join(OUT_LANDING, `${s.name}.webp`);
    // Native capture pixels (2x desktop, 3x phone) unless a width cap is given: crisp in bento cards and device mockups.
    const scale = s.width ? ['-vf', `scale='min(${s.width},iw)':-2:flags=lanczos`] : [];
    ff(['-i', s.file, ...scale, '-c:v', 'libwebp', '-quality', '84', '-compression_level', '6', '-preset', 'picture', dest]);
    const dims = String(ff(['-i', dest], { allowFail: true }).stderr).match(/, (\d+)x(\d+)/);
    out.push({ name: `${s.name}.webp`, bytes: fs.statSync(dest).size, px: dims ? `${dims[1]}x${dims[2]}` : null });
  }
  return out;
}

/**
 * README composite: docs/readme/journey.html (scoped under main.j) drawn over the live site so it uses the brand
 * font, with the fresh s-*.png/jpg, saved as a 256-colour PNG (journey.png).
 */
async function renderJourney(browser) {
  const src = fs.readFileSync(path.join(OUT_README, 'journey.html'), 'utf8');
  const css = (src.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1].replace(/@font-face\{[^}]*\}/g, '').replace(/body\{[^}]*\}/g, '');
  let main = (src.match(/<main class="j">[\s\S]*?<\/main>/) || [''])[0];
  if (!main) throw new Error('journey.html: <main class="j"> not found');
  // Images are served from disk on the site's own origin (Playwright routes), so the page CSP (img-src 'self') allows them.
  main = main.replace(/src="([^"/]+)"/g, (_, f) => `src="/__mx-readme/${f}"`);
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1180 }, deviceScaleFactor: 1, locale: 'en-GB' });
  await ctx.route('**/__mx-readme/*', (route) => {
    const name = path.basename(new URL(route.request().url()).pathname);
    const full = path.join(WORK, 'readme-full', name);
    const f = fs.existsSync(full) ? full : path.join(OUT_README, name);
    route.fulfill({ status: 200, contentType: f.endsWith('.jpg') ? 'image/jpeg' : 'image/png', body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  await go(page, '/', page.getByRole('heading', { level: 1 }).first());
  await page.evaluate(({ css, main }) => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'mx-journey'; d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647'; d.innerHTML = main; document.body.appendChild(d);
  }, { css, main });
  await page.evaluate(() => Promise.all([...document.querySelectorAll('#mx-journey img')].map((i) => i.decode().catch(() => {}))));
  await sleep(600);
  const raw = path.join(WORK, 'journey-raw.png');
  await page.screenshot({ path: raw, clip: { x: 0, y: 0, width: 1600, height: 1180 } });
  await ctx.close();
  const dest = path.join(OUT_README, 'journey.png');
  ff(['-i', raw, '-vf', 'split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a', '-compression_level', '9', dest]);
  log('README composite journey.png');
  return { name: 'journey.png', bytes: fs.statSync(dest).size };
}

/**
 * The ops caption's model label, read from the server being recorded: "mock model, not AMD" only when /api/health
 * says provider mock; otherwise the model and hardware exactly as health reports them. A provider that is selected
 * but not configured fails the recording instead of captioning a model that would only abstain.
 */
function modelCaption(health) {
  const lead = 'Queue and pharmacy flow, counts only. Honest label:';
  if (health?.provider === 'mock') return `${lead} mock model, not AMD`;
  if (!health?.provider || health.providerConfigured === false) throw new Error(`/api/health provider ${health?.provider} is not configured: refusing to caption a model label`);
  const hw = typeof health.hardware === 'string' && health.hardware.trim() && health.hardware !== '—' ? ` on ${health.hardware.trim()}` : '';
  return `${lead} ${String(health.model || health.provider).trim()}${hw}`;
}

// ---------- Main ----------
async function resetStore() {
  if (!RESET) return;
  if (!TOKEN) { log('no --token: demo store not reset (the visit code will not be the first free one)'); return; }
  await api('/api/demo/reset', { method: 'POST', headers: { 'x-demo-token': TOKEN, 'content-type': 'application/json' }, body: '{}' });
  log('demo store reset');
}

async function run(mode, opts = {}) {
  const { chromium } = loadPlaywright();
  ensureDir(WORK);
  await resetStore();
  const health = await api('/api/health');
  log(`server ${BASE}: provider ${health.provider}, model ${health.model}, store ${health.store}`);
  STEPS.ops.text = modelCaption(health);
  const browser = await chromium.launch();
  const rawDir = path.join(WORK, 'raw');
  if (mode === 'video') { fs.rmSync(rawDir, { recursive: true, force: true }); ensureDir(rawDir); }
  const ctx = await browser.newContext({
    viewport: mode === 'video' ? { width: W, height: H } : STILLS_VP,
    deviceScaleFactor: mode === 'video' ? 1 : 2,
    locale: 'en-GB',
    timezoneId: 'Asia/Bangkok',
    colorScheme: 'light',
    ...(mode === 'video' ? { recordVideo: { dir: rawDir, size: { width: W, height: H } } } : {}),
  });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('medx.lang')) localStorage.setItem('medx.lang', 'en'); } catch { /* storage blocked */ } });
  const rec = new Recorder(mode);
  rec.page = await ctx.newPage();
  rec.page.on('pageerror', (e) => log('page error:', String(e).slice(0, 200)));
  let result;
  try {
    result = await journey(rec, ctx);
  } catch (e) {
    await rec.page.screenshot({ path: path.join(WORK, `fail-${mode}.png`) }).catch(() => {});
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
    throw e;
  }
  const video = mode === 'video' ? rec.page.video() : null;
  await ctx.close();
  if (mode === 'video') {
    await browser.close();
    const raw = await video.path();
    log(`raw recording ${raw} (${mediaDuration(raw).toFixed(1)} s)`);
    // A step that ran well past its budget (a stall under load) would need a visible speed-up or lose its ending:
    // report it so main() can record another take instead of assembling this one.
    const overruns = rec.segs.map((s) => ({ id: s.id, over: (s.end - s.start) / 1000 - STEPS[s.id].t - 0.16 })).filter((o) => o.over > MAX_OVERRUN);
    if (overruns.length && opts.allowRetry) return { ...result, overruns };
    return { ...result, overruns, cueLog: rec.cueLog, ...assemble(rec, raw) };
  }
  const stills = writeStills();
  stills.push(await renderJourney(browser));
  await browser.close();
  return { ...result, stills };
}

async function main() {
  const report = {};
  if (NARR) {
    if (!DO_VIDEO) throw new Error('--narration needs --video');
    const [lo, hi] = lengthWindow();
    log(`narration ${NARR.file}: ${Object.keys(NARR.lines).length} lines; planned length ${((lo + hi) / 2).toFixed(2)} s; bed ${BED || 'none'}`);
  }
  if (args['journey-only']) {
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch();
    try { report.journey = await renderJourney(browser); } finally { await browser.close(); }
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (DO_VIDEO) {
    let v;
    for (let take = 1; take <= TAKES; take++) {
      v = await run('video', { allowRetry: take < TAKES });
      if (v.mp4) break;
      log(`take ${take}: ${v.overruns.map((o) => `${o.id} +${o.over.toFixed(1)} s`).join(', ')} over budget; recording another take`);
    }
    if (v.overruns.length) log(`warning: final take still over budget: ${v.overruns.map((o) => o.id).join(', ')}`);
    const mb = v.bytes / 1e6;
    report.video = { file: path.relative(ROOT, v.mp4), duration: Number(v.duration.toFixed(2)), mb: Number(mb.toFixed(2)), stream: v.stream, faststart: v.faststart, code: v.code, steps: v.parts.map((p) => ({ id: p.id, seconds: Number(p.out.toFixed(2)), speed: Number(p.speed.toFixed(2)) })) };
    if (NARR) Object.assign(report.video, { file: v.mp4, audioStream: v.audioStream, audio: v.audio, captions: v.captions, cueLog: v.cueLog, starts: v.cues.map((c) => ({ id: c.id, at: Number(c.start.toFixed(3)) })) });
    const [lo, hi] = lengthWindow();
    if (!(v.duration >= lo && v.duration <= hi)) throw new Error(`duration ${v.duration} s outside ${lo.toFixed(2)}..${hi.toFixed(2)} s`);
    const maxMb = NARR ? NARR_MAX_MB : MAX_MB;
    if (mb > maxMb) throw new Error(`video is ${mb.toFixed(2)} MB (> ${maxMb} MB)`);
  }
  if (DO_STILLS) {
    const s = await run('stills');
    report.stills = s.stills;
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
