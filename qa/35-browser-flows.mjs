// Real-browser acceptance flows that need a running server (Chromium via Playwright, fresh contexts):
// - M-06: as the Nurse persona on the golden case, approve the supported fields; the approved receipt keeps the case
//   actions; then the Doctor persona opens consult ?mode=doctor, drafts and signs the note.
// - C-03: while the tab is hidden, the queue, ops and pharmacy pages make no /api/sessions or /api/metrics request
//   for 60 s, and poll again at once when the tab becomes visible.
//   PLAYWRIGHT_MODULE=C:/path/to/node_modules/playwright/index.mjs BASE=http://localhost:3133 node qa/35-browser-flows.mjs
// Optional: SHOTS=<dir>; HIDDEN_MS (default 60000).
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
const json = async path => (await fetch(BASE + path)).json();
function watch(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${String(e.message).slice(0, 160)}`));
  page.on('console', m => { if (m.type() === 'error' && /Refused to|Content Security Policy/i.test(m.text())) errors.push(`csp: ${m.text().slice(0, 200)}`); });
  return errors;
}

// ---------- M-06: nurse approves, doctor signs ----------
let caseId = null;
{
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage(); const errors = watch(page);
  try {
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#demo-accounts a[href="/demo/nurse-rossi"]').first().click();
    await page.waitForURL(/\/review\/[0-9a-f-]{36}$/, { timeout: 30000 });
    caseId = /\/review\/([0-9a-f-]{36})/.exec(page.url())[1];
    await page.getByRole('button', { name: 'Approve supported fields' }).first().click({ timeout: 20000 });
    await page.getByText('Intake approved').first().waitFor({ timeout: 20000 });
  } catch (e) { errors.push(`flow: ${String(e).slice(0, 200)}`); }
  const s = caseId ? (await json(`/api/sessions/${caseId}`)).session : null;
  check('FL01', 'nurse persona: "Approve supported fields" on the golden case -> session approved, receipt "Intake approved" shown', s?.status === 'approved', { caseId, status: s?.status, errors });
  const hrefs = caseId ? await page.locator('[data-receipt="approved"] a').evaluateAll(as => as.map(a => a.getAttribute('href'))).catch(() => []) : [];
  const want = ['consult', 'vitals', 'orders', 'trace'].map(p => `/review/${caseId}/${p}`);
  check('FL02', 'approved receipt keeps the case actions: Consult, Vitals, Orders, Case trace, Review queue', want.every(w => hrefs.some(h => h?.startsWith(w))) && hrefs.includes('/review'), hrefs);
  const review = caseId ? (await json(`/api/sessions/${caseId}`)).audit.filter(e => e.type === 'review').at(-1) : null;
  check('FL03', 'the approval is audited as Nurse Anna Rossi', review?.actorId === 'Nurse Anna Rossi', review?.actorId);
  check('FL04', 'nurse flow: no uncaught page error and no CSP refusal', errors.filter(e => !e.startsWith('flow:')).length === 0, errors);
  await shot(page, 'm06-nurse-approved');
  await ctx.close();
}
if (caseId) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('medx.role', 'doctor'); localStorage.setItem('medx.clinicianRole', 'doctor'); localStorage.setItem('medx.reviewer.doctor', 'Dr. Marco Bianchi'); localStorage.setItem('medx.demo.persona', 'doctor-bianchi'); } catch { /* storage blocked */ } });
  const page = await ctx.newPage(); const errors = watch(page);
  try {
    await page.goto(`${BASE}/review/${caseId}/consult?mode=doctor`, { waitUntil: 'load', timeout: 30000 });
    await page.getByRole('button', { name: 'Draft note' }).first().click({ timeout: 20000 });
    await page.getByRole('button', { name: 'Sign note' }).first().click({ timeout: 20000 });
    await page.getByText('Note signed').first().waitFor({ timeout: 20000 });
  } catch (e) { errors.push(`flow: ${String(e).slice(0, 200)}`); }
  const c = await json(`/api/sessions/${caseId}/consult?mode=doctor`);
  const s = (await json(`/api/sessions/${caseId}`)).session;
  check('FL05', 'doctor persona on the approved case: consult ?mode=doctor -> Draft note -> Sign note -> "Note signed" by Dr. Marco Bianchi', c?.note?.signed?.reviewerId === 'Dr. Marco Bianchi', { signed: c?.note?.signed, errors });
  check('FL06', 'the intake stays approved after the doctor signs', s?.status === 'approved', s?.status);
  check('FL07', 'doctor flow: no uncaught page error and no CSP refusal', errors.filter(e => !e.startsWith('flow:')).length === 0, errors);
  await shot(page, 'm06-doctor-signed');
  await ctx.close();
}

// ---------- Two-stage pharmacy in the real UI: P1 verifies, P1 is blocked from dispensing, P2 checks 6/6, calls, collects ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage(); const errors = watch(page);
  let id = null, blockShown = false, dispenseHidden = false;
  try {
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#demo-accounts a[href="/demo/pharm-conti"]').first().click();
    await page.waitForURL(/\/pharmacy\/[0-9a-f-]{36}$/, { timeout: 30000 });
    id = /\/pharmacy\/([0-9a-f-]{36})/.exec(page.url())[1];
    await page.getByRole('button', { name: 'Verify', exact: true }).first().click({ timeout: 20000 });
    await page.getByRole('button', { name: 'Sign in as Pharmacist Nattaya Wong' }).first().waitFor({ timeout: 20000 });
    blockShown = true;
    dispenseHidden = (await page.getByRole('button', { name: 'Record final check and dispense' }).count()) === 0;
  } catch (e) { errors.push(`flow: ${String(e).slice(0, 200)}`); }
  const o1 = id ? (await json(`/api/sessions/${id}`)).session.orders.medications.at(-1) : null;
  check('FL08', 'pharmacist 1 (Laura Conti) clicks Verify -> order verified by her', o1?.status === 'verified' && o1?.pharmacist?.by === 'Pharmacist Laura Conti', { id, status: o1?.status, by: o1?.pharmacist?.by, errors });
  check('FL09', 'pharmacist 1 then sees the two-person block ("Sign in as Pharmacist Nattaya Wong") and no dispense control', blockShown && dispenseHidden, { blockShown, dispenseHidden });
  await shot(page, 'pharmacy-p1-verified');
  await ctx.close();
  if (id) {
    const c2 = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    await c2.addInitScript(() => { try { localStorage.setItem('medx.role', 'pharmacist'); localStorage.setItem('medx.reviewer.pharmacist', 'Pharmacist Nattaya Wong'); localStorage.setItem('medx.demo.persona', 'pharm-wong'); } catch { /* storage blocked */ } });
    const p2 = await c2.newPage(); const errors2 = watch(p2);
    let fiveDisabled = null, sixEnabled = null;
    try {
      await p2.goto(`${BASE}/pharmacy/${id}`, { waitUntil: 'load', timeout: 30000 });
      await p2.getByText('Six-item final check').first().waitFor({ timeout: 20000 });
      const boxes = p2.getByRole('checkbox'); const record = p2.getByRole('button', { name: 'Record final check and dispense' });
      for (let i = 0; i < 5; i++) await boxes.nth(i).check();
      fiveDisabled = await record.isDisabled();
      await boxes.nth(5).check(); sixEnabled = !(await record.isDisabled());
      await record.click();
      await p2.getByRole('button', { name: 'Call patient' }).first().click({ timeout: 20000 });
      await p2.getByRole('button', { name: 'Mark collected' }).first().click({ timeout: 20000 });
      await p2.waitForTimeout(1500);
    } catch (e) { errors2.push(`flow: ${String(e).slice(0, 200)}`); }
    const s2 = (await json(`/api/sessions/${id}`)).session; const o2 = s2.orders.medications.at(-1);
    check('FL10', 'pharmacist 2: dispense stays disabled at 5 of 6 checks and enables at 6 of 6', fiveDisabled === true && sixEnabled === true, { fiveDisabled, sixEnabled });
    check('FL11', 'pharmacist 2 (Nattaya Wong) dispenses, calls the patient and marks collected -> dispensed + pickup collected', o2?.status === 'dispensed' && o2?.dispense?.by === 'Pharmacist Nattaya Wong' && s2.pickup?.status === 'collected' && s2.pickup?.collectedBy === 'Pharmacist Nattaya Wong', { status: o2?.status, dispensedBy: o2?.dispense?.by, pickup: s2.pickup, errors: errors2 });
    check('FL12', 'pharmacy flow: no uncaught page error and no CSP refusal', [...errors, ...errors2].filter(e => !e.startsWith('flow:')).length === 0, [...errors, ...errors2]);
    await shot(p2, 'pharmacy-p2-collected');
    await c2.close();
  }
}

// ---------- C-03: polling pauses while hidden, resumes at once ----------
const HIDDEN_MS = Number(process.env.HIDDEN_MS || 60000);
const POLLERS = [['/review', 'Review queue'], ['/ops', 'Review queue'], ['/pharmacy', 'Pharmacy queue']];
const results = await Promise.all(POLLERS.map(async ([path, label]) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage(); const errors = watch(page);
  const hits = [];
  page.on('request', r => { if (/\/api\/(sessions|metrics)(\?|$|\/)/.test(new URL(r.url()).pathname + (new URL(r.url()).search ? '?' : ''))) hits.push(Date.now()); });
  let warm = false;
  try { await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }); await page.getByText(label).first().waitFor({ timeout: 20000 }); await page.waitForTimeout(6000); warm = hits.length > 0; } catch (e) { errors.push(String(e).slice(0, 160)); }
  const setVisibility = state => page.evaluate(v => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
  await setVisibility('hidden');
  const hiddenAt = Date.now() + 300; // a request already in flight when the tab hides is not counted
  await page.waitForTimeout(HIDDEN_MS);
  const whileHidden = hits.filter(t => t > hiddenAt).length;
  const shownAt = Date.now();
  await setVisibility('visible');
  await page.waitForTimeout(3000);
  const afterShown = hits.filter(t => t >= shownAt);
  await ctx.close();
  return { path, warm, whileHidden, resumeMs: afterShown.length ? afterShown[0] - shownAt : null, errors };
}));
for (const r of results) {
  console.log(`   ${r.path}: polled while visible=${r.warm}, requests while hidden=${r.whileHidden}, first request after visible=${r.resumeMs} ms`);
  check('PO01', `${r.path}: polls while visible, then no /api/sessions or /api/metrics request during ${HIDDEN_MS / 1000} s hidden`, r.warm && r.whileHidden === 0, r);
  check('PO02', `${r.path}: polls again within 3 s of becoming visible`, r.resumeMs !== null && r.resumeMs <= 3000, r);
}
await browser.close();
done();
