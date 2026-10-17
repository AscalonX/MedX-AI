// Reference matcher for packages/shared/src/consultrules.json + test runner for the table in CONSULT-SPEC.md §8.
// Usage: node docs/clinical/check-consultrules.mjs   (exit 1 on any failing row)
// Matching = red-flag semantics (REDFLAG-TESTS.md): negation cues + window come from redflags.json, clause-bounded.
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
// Windows checkouts (core.autocrlf=true) hold CRLF: strip a BOM and CR so the `$`-anchored row selectors match on every OS.
const readText = (rel) => readFileSync(new URL(rel, root), "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
const C = JSON.parse(readText("packages/shared/src/consultrules.json"));
const RF = JSON.parse(readText("packages/shared/src/redflags.json"));
const md = readText("docs/clinical/CONSULT-SPEC.md");

const norm = (t) => " " + t.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const PUNCT = [",", ".", ";", ":", "!", "?", "\n"], WORDS = [" but ", " ma ", " però ", " pero ", "แต่"];
function clause(b) {
  let c = 0;
  for (const p of PUNCT) c = Math.max(c, b.lastIndexOf(p) + 1);
  for (const w of WORDS) { const i = b.lastIndexOf(w); if (i !== -1) c = Math.max(c, i + w.length - (w.endsWith(" ") ? 1 : 0)); }
  return b.slice(c);
}
function termCounts(text, term) {
  term = norm(term).slice(1);
  for (let i = text.indexOf(term); i !== -1; i = text.indexOf(term, i + 1)) {
    const before = clause(text.slice(Math.max(0, i - RF.negationWindowChars), i));
    if (!RF.negationCues.some((c) => before.includes(c))) return true;
  }
  return false;
}
const fires = (rule, text) => rule.match.every((g) => g.some((t) => termCounts(text, t)));

// Structural checks the engine relies on.
let fail = 0, pass = 0;
const ids = new Set();
for (const r of C.rules) {
  // v1.2: considerations other than ACS-on-chest-pain need a feature AND-group beyond the presenting complaint.
  if (r.considerations?.length && r.match.length < 2 && r.id !== "CR-CHEST-01") { fail++; console.log("FAIL consideration without feature group", r.id); }
  for (const x of [r, ...r.questions, ...(r.considerations ?? [])]) { if (ids.has(x.id)) { fail++; console.log("FAIL duplicate id", x.id); } ids.add(x.id); }
  for (const q of r.questions) for (const l of ["th", "it", "en"]) if (!q.text[l] || !q.why[l]) { fail++; console.log("FAIL missing text", q.id, l); }
  for (const c of r.considerations ?? []) if (!c.text.en.startsWith("Consider ")) { fail++; console.log("FAIL consider wording", c.id); }
}
// v1.1: workup ids must exist in investigations.json; guideline needs a title and an https URL; no drug/dose text in considerations.
const INV = new Set(JSON.parse(readText("packages/shared/src/investigations.json")).items.map((i) => i.id));
for (const r of C.rules) for (const c of r.considerations ?? []) {
  for (const w of c.workup ?? []) if (!INV.has(w)) { fail++; console.log("FAIL unknown workup id", c.id, w); }
  if (c.guideline && !(c.guideline.title && /^https:\/\//.test(c.guideline.url))) { fail++; console.log("FAIL guideline", c.id); }
  if (/\b\d+\s?mg\b|\bdose\b|\bgive\b|\bstart\b|\bprescribe/i.test(JSON.stringify([c.text, c.why]))) { fail++; console.log("FAIL treatment wording", c.id); }
}
const byId = Object.fromEntries(C.rules.map((r) => [r.id, r]));
let rows = 0;
for (const line of md.split("\n")) {
  if (/^\| (CR-|NO-CONSIDER)/.test(line)) rows++;
  // v1.2: "| NO-CONSIDER | lang | text |" = no rule that carries considerations may fire (UX audit w16 case).
  const nc = line.match(/^\| NO-CONSIDER \| (en|it|th) \| (.+) \|$/);
  if (nc) {
    const hit = C.rules.filter((r) => r.considerations?.length && fires(r, norm(nc[2]))).map((r) => r.id);
    if (hit.length) { fail++; console.log(`FAIL no-consider ${nc[1]} fired ${hit.join(", ")} :: ${nc[2]}`); } else pass++;
    continue;
  }
  const m = line.match(/^\| (CR-[A-Z]+-\d+) \| (en|it|th) \| (fire|no) \| (.+) \|$/);
  if (!m) { if (/^\| (CR-|NO-CONSIDER)/.test(line)) { fail++; console.log("FAIL unparsed test row:", line); } continue; }
  const [, id, lang, expect, text] = m;
  if (!byId[id]) { fail++; console.log("FAIL unknown rule", id); continue; }
  const got = fires(byId[id], norm(text)) ? "fire" : "no";
  if (got === expect) pass++; else { fail++; console.log(`FAIL ${id} ${lang} expected=${expect} got=${got} :: ${text}`); }
}
if (!rows) { fail++; console.log("FAIL 0 test rows found in CONSULT-SPEC.md (table missing or unparseable)"); }
console.log(`${pass} passed, ${fail} failed, ${C.rules.length} rules`);
process.exit(fail ? 1 : 0);
