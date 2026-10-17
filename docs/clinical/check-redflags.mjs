// Reference matcher + test runner for packages/shared/src/redflags.json.
// Usage: node docs/clinical/check-redflags.mjs   (exit 1 on any failing row)
// The production engine lives in apps/web/lib/pipeline/ (AI engineer); this file only pins the semantics.
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const rules = JSON.parse(readFileSync(new URL("packages/shared/src/redflags.json", root), "utf8"));
const md = readFileSync(new URL("docs/clinical/REDFLAG-TESTS.md", root), "utf8");

const norm = (t) => " " + t.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

// Negation never crosses a clause boundary (v1.1): keep only the window text after the last
// punctuation mark or contrast word. Word boundaries keep their trailing space so " non " still matches.
const PUNCT = [",", ".", ";", ":", "!", "?", "\n"];
const WORDS = [" but ", " ma ", " però ", " pero ", "แต่"];
function clause(before) {
  let cut = 0;
  for (const p of PUNCT) cut = Math.max(cut, before.lastIndexOf(p) + 1);
  for (const w of WORDS) { const i = before.lastIndexOf(w); if (i !== -1) cut = Math.max(cut, i + w.length - (w.endsWith(" ") ? 1 : 0)); }
  return before.slice(cut);
}

function termCounts(text, term) {
  term = norm(term).slice(1);
  for (let i = text.indexOf(term); i !== -1; i = text.indexOf(term, i + 1)) {
    const before = clause(text.slice(Math.max(0, i - rules.negationWindowChars), i));
    if (!rules.negationCues.some((c) => before.includes(c))) return true;
  }
  return false;
}
const fires = (rule, text) => rule.match.every((group) => group.some((term) => termCounts(text, term)));

const byId = Object.fromEntries(rules.rules.map((r) => [r.id, r]));
let pass = 0, fail = 0;
for (const line of md.split("\n")) {
  const m = line.match(/^\| (RF-[A-Z0-9-]+) \| (en|it|th) \| (fire|no) \| (.+) \|$/);
  if (!m) continue;
  const [, id, lang, expect, text] = m;
  if (!byId[id]) { console.log(`FAIL unknown rule ${id}`); fail++; continue; }
  const got = fires(byId[id], norm(text)) ? "fire" : "no";
  if (got === expect) pass++;
  else { fail++; console.log(`FAIL ${id} ${lang} expected=${expect} got=${got} :: ${text}`); }
}
console.log(`${pass} passed, ${fail} failed, ${rules.rules.length} rules`);
process.exit(fail ? 1 : 0);
