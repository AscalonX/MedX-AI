// English by default (owner decision 3, M-10): first server render of the public pages is English.
//   BASE=http://localhost:3133 node qa/32-english-default.mjs
// - "/" and "/demo" serve <html lang="en">.
// - No Thai script outside elements marked lang="th" (the ไทย toggle label, and the Thai sample phrases the landing
//   shows as tagged Thai examples). Untagged Thai in English chrome fails.
// - /patient/index.html loads, with every script it references.
// - QA_REPO_CHECKS=1 also checks the repo docs: HANDOFF.md has no Thai, docs/HANDOFF.th.md keeps the Thai copy, and
//   HANDOFF.md names https://medx.areazeroai.com as the demo (not medx-bridge.vercel.app).
import { existsSync, readFileSync } from 'node:fs';
import { BASE, req, check, done } from './lib.mjs';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'stop', 'use']);
const THAI = /[฀-๿]/;
/** Thai text or attribute values whose nearest lang ancestor is not "th". Scripts, styles and comments are ignored. */
function thaiOutsideTh(html) {
  const blank = m => ' '.repeat(m.length);
  const src = html.replace(/<script[\s\S]*?<\/script>/gi, blank).replace(/<style[\s\S]*?<\/style>/gi, blank).replace(/<!--[\s\S]*?-->/g, blank);
  const stack = [{ tag: '#root' }], out = [];
  const lang = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].lang) return stack[i].lang.toLowerCase(); return ''; };
  const where = () => stack.slice(-3).map(s => s.tag + (s.lang ? `[lang=${s.lang}]` : '')).join(' > ');
  const scanText = t => { for (const x of t.matchAll(/[฀-๿][฀-๿\s]*/g)) if (lang() !== 'th') out.push(`${x[0].trim()} @ ${where()}`); };
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    scanText(src.slice(last, m.index)); last = re.lastIndex;
    const [, close, raw, attrs] = m; const tag = raw.toLowerCase();
    if (close) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
    stack.push({ tag, lang: /\slang="([^"]*)"/.exec(attrs)?.[1] });
    for (const a of attrs.matchAll(/\s([a-zA-Z:-]+)="([^"]*)"/g)) if (THAI.test(a[2]) && lang() !== 'th') out.push(`${a[1]}="${a[2]}" @ ${where()}`);
    if (VOID.has(tag) || attrs.trim().endsWith('/')) stack.pop();
  }
  scanText(src.slice(last));
  return out;
}

for (const path of ['/', '/demo']) {
  const r = await req('GET', path);
  check('EN01', `GET ${path} -> 200 with <html lang="en">`, r.status === 200 && /<html[^>]*\slang="en"/.test(r.text), [r.status, r.text.match(/<html[^>]*>/)?.[0]?.slice(0, 60)]);
  const bad = thaiOutsideTh(r.text);
  check('EN02', `GET ${path}: no Thai script outside lang="th" elements (toggle label and tagged Thai samples only)`, bad.length === 0, bad.slice(0, 8));
  const toggle = /lang="th"[^>]*>ไทย</.test(r.text);
  check('EN03', `GET ${path}: the language toggle shows the Thai label ไทย, marked lang="th"`, toggle, 'toggle label not found');
}

// Staff and patient entry points also render English on the server (client language switching happens later).
for (const path of ['/review', '/pharmacy', '/ops', '/home']) {
  const r = await req('GET', path);
  const bad = thaiOutsideTh(r.text);
  check('EN04', `GET ${path} -> 200, <html lang="en">, no untagged Thai in the server render`, r.status === 200 && /<html[^>]*\slang="en"/.test(r.text) && bad.length === 0, [r.status, bad.slice(0, 5)]);
}

const p = await req('GET', '/patient/index.html');
check('EN05', 'GET /patient/index.html -> 200 text/html with <html lang="en">', p.status === 200 && /text\/html/.test(p.headers.get('content-type') || '') && /<html[^>]*\slang="en"/.test(p.text), [p.status, p.headers.get('content-type')]);
const scripts = [...p.text.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
const loaded = await Promise.all(scripts.map(async s => { const r = await fetch(new URL(s, BASE)); const t = await r.text(); return [s, r.status, r.headers.get('content-type'), t.length]; }));
check('EN06', `/patient/index.html: every referenced script loads (${scripts.length} bundles)`, scripts.length >= 2 && loaded.every(([, s, t, n]) => s === 200 && /javascript/.test(t || '') && n > 100), loaded.map(([s, st]) => `${s.split('/').pop()}:${st}`));

if (process.env.QA_REPO_CHECKS === '1') {
  const root = new URL('../', import.meta.url);
  const read = f => existsSync(new URL(f, root)) ? readFileSync(new URL(f, root), 'utf8') : null;
  const handoff = read('HANDOFF.md'), th = read('docs/HANDOFF.th.md');
  const thaiLines = (handoff || '').split('\n').filter(l => THAI.test(l)).length;
  check('EN07', `HANDOFF.md has no Thai script (${thaiLines} Thai line(s))`, handoff !== null && thaiLines === 0, (handoff || '').split('\n').filter(l => THAI.test(l)).slice(0, 3));
  check('EN08', 'docs/HANDOFF.th.md keeps the Thai copy', th !== null && THAI.test(th), th === null ? 'missing' : 'no Thai text');
  // medx-bridge.vercel.app may only appear on a line that marks it as old / not the demo.
  const bridge = (handoff || '').split('\n').filter(l => /medx-bridge\.vercel\.app/.test(l));
  check('EN09', 'HANDOFF.md names https://medx.areazeroai.com as the demo and does not present medx-bridge.vercel.app as a demo', handoff !== null && handoff.includes('https://medx.areazeroai.com') && bridge.every(l => /\b(old|older|retired|deprecated|legacy|not|no longer|do not use)\b/i.test(l)), { areazeroai: !!handoff?.includes('https://medx.areazeroai.com'), bridgeLines: bridge.slice(0, 3) });
}
done();
