// Real-browser checks (Chromium via Playwright), each in a FRESH context (empty storage):
// - English first render of /review, /pharmacy, /ops and /patient, also with a Thai browser locale (M-10).
// - Every landing persona card lands on the right surface with the right identity stored and shown (M-07).
// - No uncaught page errors and no CSP "Refused to ..." console errors on those pages.
//   PLAYWRIGHT_MODULE=C:/path/to/node_modules/playwright/index.mjs BASE=http://localhost:3133 node qa/34-browser.mjs
// Optional: SHOTS=<dir> saves a screenshot per page.
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { BASE, check, done } from './lib.mjs';

async function loadPlaywright() {
  for (const spec of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
    try { const m = await import(/^[a-z@]/i.test(spec) && !/^[a-z]:[\\/]/i.test(spec) ? spec : pathToFileURL(spec).href); return m.chromium ? m : m.default; } catch { /* next candidate */ }
  }
  throw new Error('Playwright not found: set PLAYWRIGHT_MODULE to .../node_modules/playwright/index.mjs');
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `${name}.png`), fullPage: false }).catch(() => {}); };
/** Visible text nodes containing Thai whose nearest [lang] ancestor is not "th". */
const untaggedThai = page => page.evaluate(() => {
  const out = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!/[\u0E00-\u0E7F]/.test(n.nodeValue || '')) continue;
    const el = n.parentElement; if (!el || (el.checkVisibility && !el.checkVisibility())) continue;
    const lang = el.closest('[lang]')?.getAttribute('lang') || '';
    if (lang !== 'th') out.push(`${(n.nodeValue || '').trim().slice(0, 40)} @ ${el.tagName.toLowerCase()}[lang=${lang}]`);
  }
  return out;
});
function watch(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${String(e.message).slice(0, 160)}`));
  page.on('console', m => { if (m.type() === 'error' && /Refused to|Content Security Policy/i.test(m.text())) errors.push(`csp: ${m.text().slice(0, 200)}`); });
  return errors;
}

// ---------- 1. English first render in a fresh context ----------
const FIRST = [
  ['/review', 'Review queue'],
  ['/pharmacy', 'Pharmacy queue'],
  ['/ops', 'Review queue'],
  ['/patient/', 'Tell us what brings you in today'],
];
for (const locale of ['en-US', 'th-TH']) {
  for (const [path, label] of FIRST) {
    const context = await browser.newContext({ locale, viewport: { width: 1280, height: 860 } });
    const page = await context.newPage(); const errors = watch(page);
    let seen = false;
    try { await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }); await page.getByText(label, { exact: false }).first().waitFor({ timeout: 20000 }); seen = true; } catch { /* reported below */ }
    await page.waitForTimeout(800);
    const lang = await page.evaluate(() => document.documentElement.lang).catch(() => '');
    const all = await untaggedThai(page).catch(e => [String(e)]);
    // The TH toggle label "ไทย" is the one Thai string M-10 allows; an untagged one is only an a11y note (lang="th" missing).
    const toggle = all.filter(x => x.startsWith('ไทย @')), thai = all.filter(x => !x.startsWith('ไทย @'));
    if (toggle.length) console.log(`   note: ${path} shows the TH toggle label without lang="th" (${toggle[0]})`);
    check('BR01', `fresh context, browser locale ${locale}: ${path} first renders English ("${label}" visible, <html lang="en">, no Thai besides the TH toggle label)`, seen && lang === 'en' && thai.length === 0, { seen, lang, thai: thai.slice(0, 5) });
    check('BR02', `${locale} ${path}: no uncaught page error and no CSP refusal`, errors.length === 0, errors.slice(0, 4));
    await shot(page, `first-${locale}-${path.replace(/\W+/g, '_') || 'root'}`);
    await context.close();
  }
}

// ---------- 2. Persona cards land with the right identity ----------
const PERSONAS = [
  { id: 'patient', role: null, name: null, url: /\/patient\/?\?new=1&lang=en/, visible: 'Tell us what brings you in today' },
  { id: 'nurse-rossi', role: 'nurse', name: 'Nurse Anna Rossi', url: /\/review\/[0-9a-f-]{36}$/ },
  { id: 'doctor-bianchi', role: 'doctor', name: 'Dr. Marco Bianchi', url: /\/review\/[0-9a-f-]{36}\/consult\?mode=doctor/ },
  { id: 'pharm-conti', role: 'pharmacist', name: 'Pharmacist Laura Conti', url: /\/pharmacy\/[0-9a-f-]{36}$/ },
  { id: 'pharm-wong', role: 'pharmacist', name: 'Pharmacist Nattaya Wong', url: /\/pharmacy\/[0-9a-f-]{36}$/ },
  { id: 'ops-head', role: 'ops', name: 'Head Nurse Elena Greco', url: /\/ops\/?$/ },
];
for (const p of PERSONAS) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage(); const errors = watch(page);
  let landed = '', ok = false;
  try {
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
    await page.locator(`#demo-accounts a[href="/demo/${p.id}"]`).first().click();
    await page.waitForURL(p.url, { timeout: 30000 }); ok = true;
  } catch { /* reported below */ }
  landed = page.url().replace(BASE, '');
  const ls = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('medx.')).map(k => [k, localStorage.getItem(k)]))).catch(() => ({}));
  check('BR03', `persona ${p.id}: card on / lands on ${p.url}`, ok, landed);
  const identityOk = ls['medx.demo.persona'] === p.id && (!p.role || (ls['medx.role'] === p.role && ls[`medx.reviewer.${p.role}`] === p.name && (!['nurse', 'doctor'].includes(p.role) || ls['medx.clinicianRole'] === p.role)));
  check('BR04', `persona ${p.id}: identity stored (medx.demo.persona${p.role ? `, medx.role=${p.role}, medx.reviewer.${p.role}=${p.name}` : ''})`, identityOk, ls);
  const text = p.visible || p.name;
  let shown = false; try { await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 }); shown = true; } catch { /* reported */ }
  check('BR05', `persona ${p.id}: "${text}" is shown on the landing surface`, shown, landed);
  const caseId = /\/(?:review|pharmacy)\/([0-9a-f-]{36})/.exec(landed)?.[1];
  if (caseId) {
    const s = (await (await fetch(`${BASE}/api/sessions/${caseId}`)).json()).session;
    const meds = s?.orders?.medications || [];
    const stageOk = p.id === 'nurse-rossi' ? s?.status === 'awaiting_review' && !s?.triage
      : p.id === 'doctor-bianchi' ? !!s?.triage?.confirmed && !meds.length
      : p.id === 'pharm-conti' ? meds.some(o => o.status === 'submitted')
      : p.id === 'pharm-wong' ? meds.some(o => o.status === 'verified' && o.pharmacist?.by === 'Pharmacist Laura Conti') : true;
    check('BR06', `persona ${p.id}: the case is at this persona's step`, stageOk, { status: s?.status, triage: !!s?.triage?.confirmed, orders: meds.map(o => `${o.status}:${o.pharmacist?.by || ''}`) });
  }
  check('BR07', `persona ${p.id}: no uncaught page error and no CSP refusal`, errors.length === 0, errors.slice(0, 4));
  await shot(page, `persona-${p.id}`);
  await context.close();
}
// ---------- 3. The phone keeps a visit whose medicine is on its way (code review finding, w20) ----------
// A phone holding a visit at "ready" (counter call pending) must not drop it on Start or New intake; a collected visit may.
async function demoCase(stage) {
  const r = await fetch(`${BASE}/api/demo/start`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.18.250.${Math.floor(Math.random() * 250) + 1}` }, body: JSON.stringify({ stage }) });
  const j = await r.json(); if (!r.ok) throw new Error(`demo/start ${stage}: ${r.status} ${JSON.stringify(j)}`);
  return (await (await fetch(`${BASE}/api/sessions/${j.id}?view=patient`)).json()).session;
}
// Since w20 patient polish, Home with a stored visit says "Your visit is open" with "Open my visit" (the old hero
// "Start" silently discarded the visit), and a stored visit is cleared only through the "Start a new visit" confirm
// sheet. The tab "+" ("New intake") opens a visit whose medicine is waiting, with no sheet.
//   open : Home hero "Open my visit"            -> /patient/done, visit kept, no silent-discard "Start" offered
//   tab  : tab "+" (New intake)                 -> /patient/done, visit kept, no confirm sheet
//   keep : "Start a new visit" -> "Keep my visit" -> the sheet warns that medicine is waiting; visit kept
//   clear: "Start a new visit" -> "Clear and start again" on a collected visit -> visit cleared (control)
const PHONE_CASES = [
  ['ready_for_pickup', 'open', 'Home "Open my visit"', true],
  ['ready_for_pickup', 'tab', 'New intake (tab +)', true],
  ['ready_for_pickup', 'keep', '"Start a new visit" then "Keep my visit"', true],
  ['collected', 'clear', '"Start a new visit" then "Clear and start again"', false],
];
const storedId = page => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('medx.patient.v1') || '{}').session?.id ?? null; } catch { return 'unreadable'; } });
for (const [stage, how, label, keep] of PHONE_CASES) {
  let view; try { view = await demoCase(stage); } catch (e) { check('BR08', `phone visit at ${stage}: ${label}`, false, String(e)); continue; }
  const context = await browser.newContext({ viewport: { width: 420, height: 860 } });
  await context.addInitScript(v => { try { if (!sessionStorage.getItem('qa-seeded')) { localStorage.setItem('medx.patient.v1', JSON.stringify({ session: v, lang: 'en' })); sessionStorage.setItem('qa-seeded', '1'); } } catch { /* storage blocked */ } }, view);
  const page = await context.newPage(); const errors = watch(page);
  let url = '', kept = null; const seen = {};
  try {
    await page.goto(BASE + '/patient/', { waitUntil: 'load', timeout: 30000 });
    await page.getByText('Home', { exact: true }).first().click({ timeout: 20000 });
    await page.getByText('Your visit is open', { exact: true }).first().waitFor({ timeout: 20000 });
    // A stored visit is never offered the old one-tap "Start" that replaced it.
    seen.startPill = await page.getByRole('button', { name: 'Start', exact: true }).count();
    if (how === 'open') await page.getByRole('button', { name: 'Open my visit', exact: true }).first().click();
    else if (how === 'tab') await page.getByRole('button', { name: 'New intake', exact: true }).first().click();
    else {
      await page.getByRole('button', { name: 'Start a new visit', exact: true }).first().click();
      await page.getByText('Start a new visit?', { exact: true }).first().waitFor({ timeout: 10000 });
      seen.pickupWarning = await page.getByText('You have not collected your medicine yet', { exact: false }).count();
      await page.getByRole('button', { name: how === 'keep' ? 'Keep my visit' : 'Clear and start again', exact: true }).last().click();
    }
    await page.waitForTimeout(2500);
    seen.sheetOpen = await page.getByText('Start a new visit?', { exact: true }).count();
    if (how === 'clear') seen.freshHero = await page.getByText('Tell us what brings you in today', { exact: true }).count();
    url = page.url().replace(BASE, '');
    const id = await storedId(page); kept = id === view.id; seen.storedId = id;
  } catch (e) { url = `error: ${String(e).slice(0, 120)}`; }
  const noStart = seen.startPill === 0;
  const ok = how === 'open' || how === 'tab' ? kept === true && /\/patient\/done/.test(url) && noStart && seen.sheetOpen === 0
    : how === 'keep' ? kept === true && noStart && seen.pickupWarning > 0 && seen.sheetOpen === 0
    : kept === false && seen.storedId === null && seen.pickupWarning === 0 && seen.freshHero > 0;
  check('BR08', keep ? `phone visit at ${stage} (medicine ready): ${label} keeps the visit${how === 'keep' ? ' (sheet warns medicine is waiting)' : ' and shows it (/patient/done)'}`
    : `phone visit at ${stage}: ${label} clears it for a new visit (control)`, ok, { url, kept, ...seen });
  check('BR09', `phone visit at ${stage} / ${label}: no uncaught page error and no CSP refusal`, errors.length === 0, errors.slice(0, 4));
  await shot(page, `phone-${stage}-${how}`);
  await context.close();
}
await browser.close();
done();
