// Reference matcher + alert engine for packages/shared/src/medrules.json, and test runner for MEDRULES-TESTS.md.
// Usage: node docs/clinical/check-medrules.mjs   (exit 1 on any failing row)
// The production engine lives in apps/web/lib/pipeline/ (AI engineer); this file pins the semantics (PHARMACY-SPEC §5).
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const R = JSON.parse(readFileSync(new URL("packages/shared/src/medrules.json", root), "utf8"));
const md = readFileSync(new URL("docs/clinical/MEDRULES-TESTS.md", root), "utf8");

// Pad BOTH sides so spaced short brands (" sara ", " oki ", " cpm ") match a whole word. Never trim terms.
const norm = (t) => " " + t.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim() + " ";

/** Longest matching name wins; ties go to the first entry in the file. */
function lookup(text, entries) {
  const t = norm(text); let best = null, len = 0;
  for (const e of entries) for (const n of e.names) if (n.length > len && t.includes(n.normalize("NFC"))) { best = e; len = n.length; }
  return best;
}
const ingredients = (generic) => generic.split("+").map((s) => s.trim());
const maxDose = Object.fromEntries(R.drugs.filter((d) => d.maxDailyMg && !d.generic.includes("+")).map((d) => [d.generic, d.maxDailyMg]));
const HIGH_DUP = new Set(["nsaid", "anticoagulant", "opioid", "ssri"]);
const NO_DUP = new Set(["insulin"]);

export function alerts(medNames, allergyNames, pregnancy) {
  const meds = medNames.map((n) => { const d = lookup(n, R.drugs); return { n, d, tokens: d ? new Set([d.drugClass, ...ingredients(d.generic)]) : new Set() }; });
  const alls = allergyNames.map((n) => lookup(n, R.allergens)).filter(Boolean);
  const out = new Set();
  for (const m of meds) {
    if (!m.d || m.d.generic.endsWith("(unspecified)")) out.add("MR-UNKNOWN-01");
    if (m.d?.pregnancy && (pregnancy === "pregnant" || pregnancy === "possible")) out.add(m.d.pregnancy === "avoid" ? "MR-PREG-01" : "MR-PREG-02");
    for (const a of alls) for (const c of R.allergyConflicts)
      if (c.allergenClass === a.allergenClass && c.drugClasses.some((x) => m.tokens.has(x))) out.add(c.ruleId);
  }
  for (let i = 0; i < meds.length; i++) for (let j = i + 1; j < meds.length; j++) {
    const [x, y] = [meds[i], meds[j]]; if (!x.d || !y.d) continue;
    const shared = [...x.tokens].filter((t) => y.tokens.has(t) && !NO_DUP.has(t));
    if (shared.some((t) => maxDose[t])) out.add("MR-MAXDOSE-01");
    const dup = shared.filter((t) => !maxDose[t]);
    if (dup.length) out.add(dup.some((t) => HIGH_DUP.has(t)) ? "MR-DUP-01" : "MR-DUP-02");
    // One alert per pair: the highest-severity matching interaction rule.
    const hits = R.interactions.filter((r) => (x.tokens.has(r.a) && y.tokens.has(r.b)) || (x.tokens.has(r.b) && y.tokens.has(r.a)));
    const top = hits.find((r) => r.severity === "high") ?? hits[0];
    if (top) out.add(top.ruleId);
  }
  return out;
}

/** dose_range (MedicationOrder): MR-DOSE-01 single dose > maxSingleMg; MR-DOSE-02 doseMg × timesPerDay > maxDailyMg. Unknown drug or no doseRange → no dose alert. */
export function doseAlerts(drugText, doseMg, timesPerDay) {
  const r = lookup(drugText, R.drugs)?.doseRange, out = new Set();
  if (!r) return out;
  if (r.maxSingleMg != null && doseMg > r.maxSingleMg) out.add("MR-DOSE-01");
  if (r.maxDailyMg != null && timesPerDay != null && doseMg * timesPerDay > r.maxDailyMg) out.add("MR-DOSE-02");
  return out;
}

let pass = 0, fail = 0;
const split = (s) => (s.trim() === "-" ? [] : s.split(";").map((x) => x.trim()).filter(Boolean));
for (const line of md.split("\n")) {
  let m = line.match(/^\| L \| (en|it|th) \| (.+?) \| (.+?) \|$/);
  if (m) {
    const got = lookup(m[2], R.drugs)?.generic ?? "(none)";
    if (got === m[3]) pass++; else { fail++; console.log(`FAIL lookup ${m[1]} "${m[2]}" expected=${m[3]} got=${got}`); }
    continue;
  }
  m = line.match(/^\| AL \| (en|it|th) \| (.+?) \| (.+?) \|$/);
  if (m) {
    const got = lookup(m[2], R.allergens)?.allergenClass ?? "(none)";
    if (got === m[3]) pass++; else { fail++; console.log(`FAIL allergen ${m[1]} "${m[2]}" expected=${m[3]} got=${got}`); }
    continue;
  }
  m = line.match(/^\| D \| (en|it|th) \| (!?MR-DOSE-0[12]) \| (.+?) \| ([\d.]+) \| ([\d.]+) \|$/);
  if (m) {
    const got = doseAlerts(m[3], Number(m[4]), Number(m[5])), want = !m[2].startsWith("!"), id = m[2].replace("!", "");
    if (got.has(id) === want) pass++; else { fail++; console.log(`FAIL dose ${m[1]} expected ${m[2]} got [${[...got].join(", ")}] :: ${m[3]} ${m[4]} mg x${m[5]}`); }
    continue;
  }
  m = line.match(/^\| A \| (en|it|th) \| (!?MR-[A-Z0-9-]+) \| (.+?) \| (.+?) \| (pregnant|possible|no|-) \|$/);
  if (!m) continue;
  const [, lang, expect, meds, alls, preg] = m;
  const got = alerts(split(meds), split(alls), preg);
  const want = !expect.startsWith("!"), id = expect.replace("!", "");
  if (got.has(id) === want) pass++;
  else { fail++; console.log(`FAIL alert ${lang} expected ${expect} got [${[...got].join(", ")}] :: meds=${meds} allergies=${alls} preg=${preg}`); }
}
console.log(`${pass} passed, ${fail} failed · ${R.drugs.length} drugs, ${R.allergens.length} allergen classes, ${R.allergyConflicts.length} allergy rules, ${R.interactions.length} interactions`);
process.exit(fail ? 1 : 0);
