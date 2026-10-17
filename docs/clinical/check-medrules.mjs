// Reference matcher + alert engine for packages/shared/src/medrules.json, and test runner for MEDRULES-TESTS.md.
// Usage: node docs/clinical/check-medrules.mjs   (exit 1 on any failing row or any alternatives-table error)
// The production engine lives in apps/web/lib/pipeline/ (AI engineer); this file pins the semantics (PHARMACY-SPEC §5, §10).
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const R = JSON.parse(readFileSync(new URL("packages/shared/src/medrules.json", root), "utf8"));
// Git checks the markdown out with CRLF on Windows (core.autocrlf). Split on \r?\n and drop a BOM so the
// row regexes, which end in `\|$`, still match; before this every row was reported as unparsed.
const md = readFileSync(new URL("docs/clinical/MEDRULES-TESTS.md", root), "utf8").replace(/^﻿/, "");

// Pad BOTH sides so spaced short brands (" sara ", " oki ", " cpm ") match a whole word. Never trim terms.
const norm = (t) => " " + t.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim() + " ";

/** Longest matching name wins; ties go to the first entry in the file. */
function lookup(text, entries) {
  const t = norm(text); let best = null, len = 0;
  for (const e of entries) for (const n of e.names) if (n.length > len && t.includes(n.normalize("NFC"))) { best = e; len = n.length; }
  return best;
}
const ingredients = (generic) => generic.split("+").map((s) => s.trim());
const tokensOf = (d) => new Set([d.drugClass, ...ingredients(d.generic)]);
const maxDose = Object.fromEntries(R.drugs.filter((d) => d.maxDailyMg && !d.generic.includes("+")).map((d) => [d.generic, d.maxDailyMg]));
const byGeneric = new Map(R.drugs.map((d) => [d.generic, d]));
const HIGH_DUP = new Set(["nsaid", "anticoagulant", "opioid", "ssri"]);
const NO_DUP = new Set(["insulin"]);

/** Every alert over `drugs` (dictionary entries, or null = not identified) as { ruleId, kind, meds: [indices] }. */
function alertList(drugs, alls, pregnancy) {
  const meds = drugs.map((d) => ({ d, tokens: d ? tokensOf(d) : new Set() }));
  const out = new Map();
  const add = (ruleId, kind, idx) => { const k = `${ruleId}:${idx.join(",")}`; if (!out.has(k)) out.set(k, { ruleId, kind, meds: idx }); };
  meds.forEach((m, i) => {
    if (!m.d || m.d.generic.endsWith("(unspecified)")) add("MR-UNKNOWN-01", "unknown_medication", [i]);
    if (m.d?.pregnancy && (pregnancy === "pregnant" || pregnancy === "possible")) add(m.d.pregnancy === "avoid" ? "MR-PREG-01" : "MR-PREG-02", "pregnancy_caution", [i]);
    for (const a of alls) for (const c of R.allergyConflicts)
      if (c.allergenClass === a.allergenClass && c.drugClasses.some((x) => m.tokens.has(x))) add(c.ruleId, "allergy_conflict", [i]);
  });
  for (let i = 0; i < meds.length; i++) for (let j = i + 1; j < meds.length; j++) {
    const [x, y] = [meds[i], meds[j]]; if (!x.d || !y.d) continue;
    const shared = [...x.tokens].filter((t) => y.tokens.has(t) && !NO_DUP.has(t));
    if (shared.some((t) => maxDose[t])) add("MR-MAXDOSE-01", "max_dose_risk", [i, j]);
    const dup = shared.filter((t) => !maxDose[t]);
    if (dup.length) add(dup.some((t) => HIGH_DUP.has(t)) ? "MR-DUP-01" : "MR-DUP-02", "duplicate_therapy", [i, j]);
    // One alert per pair: the highest-severity matching interaction rule.
    const hits = R.interactions.filter((r) => (x.tokens.has(r.a) && y.tokens.has(r.b)) || (x.tokens.has(r.b) && y.tokens.has(r.a)));
    const top = hits.find((r) => r.severity === "high") ?? hits[0];
    if (top) add(top.ruleId, "interaction", [i, j]);
  }
  return [...out.values()];
}
const drugsOf = (names) => names.map((n) => lookup(n, R.drugs));
const allergensOf = (names) => names.map((n) => lookup(n, R.allergens)).filter(Boolean);

export function alerts(medNames, allergyNames, pregnancy) {
  return new Set(alertList(drugsOf(medNames), allergensOf(allergyNames), pregnancy).map((a) => a.ruleId));
}

/** dose_range (MedicationOrder), engine ids (apps/web/lib/pipeline/orders.ts):
 *  MR-DOSE-RANGE (high): single dose > maxSingleMg and/or dose × timesPerDay > maxDailyMg (one alert per order).
 *  MR-DOSE-UNCHECKED (moderate): drug unknown, no doseRange, or dose/frequency not parsed. */
export function doseAlerts(drugText, doseMg, timesPerDay) {
  const r = lookup(drugText, R.drugs)?.doseRange, out = new Set();
  if (!r || doseMg == null || timesPerDay == null || Number.isNaN(doseMg) || Number.isNaN(timesPerDay)) { out.add("MR-DOSE-UNCHECKED"); return out; }
  if ((r.maxSingleMg != null && doseMg > r.maxSingleMg) || (r.maxDailyMg != null && doseMg * timesPerDay > r.maxDailyMg)) out.add("MR-DOSE-RANGE");
  return out;
}

// ---------- Alternatives (PHARMACY-SPEC §10) ----------
// A candidate is dropped when, replacing the ordered drug, it would itself raise one of these for THIS patient.
// max_dose_risk is the same-ingredient (paracetamol) form of duplicate therapy, so it blocks too (engine: ALTERNATIVE_BLOCKERS).
const BLOCKERS = new Set(["allergy_conflict", "interaction", "duplicate_therapy", "pregnancy_caution", "max_dose_risk"]);

/** Alerts on the ordered drug (others = the patient's other current medicines / active orders), each with its alternatives. */
export function prescribingAlternatives(orderedName, otherNames, allergyNames, pregnancy, table = R.alternatives ?? []) {
  const ordered = lookup(orderedName, R.drugs), others = drugsOf(otherNames), alls = allergensOf(allergyNames);
  const ctx = [...others, ordered], at = ctx.length - 1;
  const passes = (g) => {
    const d = byGeneric.get(g); if (!d || g.endsWith("(unspecified)")) return false;
    const hyp = [...others, d], k = hyp.length - 1; // the candidate replaces the order, it does not sit next to it
    return !alertList(hyp, alls, pregnancy).some((a) => a.meds.includes(k) && BLOCKERS.has(a.kind));
  };
  return alertList(ctx, alls, pregnancy).filter((a) => a.meds.includes(at)).map((a) => {
    if (!ordered) return { ...a, alternatives: [] };
    const cands = [...new Set(table.filter((e) => e.kinds.includes(a.kind) && e.drugClasses.includes(ordered.drugClass)).flatMap((e) => e.consider))];
    return { ...a, alternatives: cands.filter((g) => g !== ordered.generic && passes(g)) };
  });
}

const ALT_KEYS = new Set(["id", "kinds", "drugClasses", "consider", "note", "source"]);
// Kinds where "another drug" is a meaningful option. dose_range / max_dose_risk / unknown_medication are fixed by
// changing the dose, the count or identifying the product, never by suggesting a different drug.
const ALT_KINDS = new Set(["allergy_conflict", "interaction", "duplicate_therapy", "pregnancy_caution"]);
const FRAMING = {
  en: [/prescriber/i, /review/i, /not a prescription/i],
  it: [/prescrittore/i, /non una prescrizione/i],
  th: [/แพทย์ผู้สั่งยาพิจารณา/, /ไม่ใช่คำสั่งใช้ยา/],
};
const INSTRUCTION = /\b(switch to|replace with|change to|use instead|substitute|give|start|prescribe|must take)\b/i;
const SOURCE = /\b(BNF|NICE|WHO|FDA|MHRA)\b/;

/** Strict validation of medrules.alternatives (MedRuleFile.alternatives). Returns { errors, warnings }. */
export function validateAlternatives(table, rules = R) {
  const errors = [], warnings = [];
  if (!Array.isArray(table) || table.length === 0) return { errors: ["alternatives: missing or empty (expected a non-empty array)"], warnings };
  const drugs = new Map(rules.drugs.map((d) => [d.generic, d]));
  const classes = new Set(rules.drugs.map((d) => d.drugClass));
  const kinds = new Set(Object.keys(rules.messages)); // messages is Record<MedAlertKind, …>: the known kinds
  const ids = new Set(), pairs = new Map();
  table.forEach((e, i) => {
    const at = `alternatives[${i}]${typeof e?.id === "string" ? ` ${e.id}` : ""}`;
    const err = (m) => errors.push(`${at}: ${m}`), warn = (m) => warnings.push(`${at}: ${m}`);
    if (!e || typeof e !== "object" || Array.isArray(e)) return err("entry is not an object");
    for (const k of Object.keys(e)) if (!ALT_KEYS.has(k)) err(`unknown property "${k}"`);
    if (typeof e.id !== "string" || !/^ALT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(e.id)) err("id must look like ALT-UPPER-CASE");
    else if (ids.has(e.id)) err("duplicate id"); else ids.add(e.id);
    const list = (name) => {
      const v = e[name];
      if (!Array.isArray(v) || v.length === 0) { err(`${name} must be a non-empty array`); return []; }
      if (v.some((x) => typeof x !== "string" || !x.trim())) err(`${name} contains a non-string or blank value`);
      if (new Set(v).size !== v.length) err(`${name} contains duplicates`);
      return v.filter((x) => typeof x === "string");
    };
    const ks = list("kinds"), dcs = list("drugClasses"), cons = list("consider");
    for (const k of ks) {
      if (!kinds.has(k)) err(`unknown kind "${k}"`);
      else if (!ALT_KINDS.has(k)) err(`kind "${k}" cannot carry alternatives (allowed: ${[...ALT_KINDS].join(", ")})`);
    }
    for (const c of dcs) if (!classes.has(c)) err(`unknown drugClass "${c}" (no drug in drugs[] has it)`);
    for (const k of ks) for (const c of dcs) {
      const p = `${k}/${c}`;
      if (pairs.has(p)) err(`${p} is already mapped by ${pairs.get(p)} (one entry per kind and class)`); else pairs.set(p, e.id ?? at);
    }
    if (cons.length > 5) err("consider lists more than 5 generics (PharmacistReport.suggestedGenerics max 5)");
    // Allergy classes that can trigger an allergy_conflict on a drug of one of these classes.
    const triggers = new Set(rules.allergyConflicts.filter((c) => c.drugClasses.some((x) => dcs.includes(x))).map((c) => c.allergenClass));
    // Interaction partners of these classes (by class token), for the shared-partner warning below.
    const partners = new Set(rules.interactions.flatMap((r) => (dcs.includes(r.a) ? [r.b] : dcs.includes(r.b) ? [r.a] : [])));
    for (const g of cons) {
      const d = drugs.get(g);
      if (!d) { err(`unknown generic "${g}" (consider must name a generic in drugs[])`); continue; }
      if (g.endsWith("(unspecified)") || g.includes("+")) err(`"${g}" is a lay or combination entry, not a single generic`);
      const t = tokensOf(d);
      const own = dcs.filter((c) => t.has(c));
      if (own.length) err(`"${g}" (class ${d.drugClass}) is itself in drugClasses [${own.join(", ")}]`);
      if (ks.includes("allergy_conflict")) for (const a of triggers) for (const c of rules.allergyConflicts)
        if (c.allergenClass === a && c.drugClasses.some((x) => t.has(x))) err(`"${g}" conflicts with the triggering allergy class "${a}" (${c.ruleId})`);
      if (ks.includes("pregnancy_caution") && d.pregnancy) err(`"${g}" is itself pregnancy: "${d.pregnancy}" (it would always be dropped)`);
      if (ks.includes("interaction")) for (const p of partners) {
        if (t.has(p)) warn(`"${g}" is itself an interaction partner (${p}) of these classes`);
        const shared = rules.interactions.find((r) => (r.a === p && t.has(r.b)) || (r.b === p && t.has(r.a)));
        if (shared) warn(`"${g}" also interacts with partner ${p} (${shared.ruleId}); it will be dropped for those patients`);
      }
    }
    const note = e.note;
    if (!note || typeof note !== "object" || Array.isArray(note)) err("note must be a Localized object { th, it, en }");
    else {
      for (const k of Object.keys(note)) if (!(k in FRAMING)) err(`note has unknown language "${k}"`);
      for (const [lang, res] of Object.entries(FRAMING)) {
        const s = note[lang];
        if (typeof s !== "string" || !s.trim()) { err(`note.${lang} missing or blank`); continue; }
        for (const re of res) if (!re.test(s)) err(`note.${lang} must keep the claim-boundary framing (missing ${re})`);
      }
      if (typeof note.en === "string" && INSTRUCTION.test(note.en)) err(`note.en reads as an instruction ("${note.en.match(INSTRUCTION)[0]}"); frame it as an option for prescriber review`);
    }
    if (typeof e.source !== "string" || e.source.trim().length < 20) err("source missing or too short");
    else if (!SOURCE.test(e.source)) err("source must cite BNF, NICE, WHO, FDA or MHRA");
  });
  return { errors, warnings };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log(msg); } };

// 1. The real table.
const v = validateAlternatives(R.alternatives);
for (const e of v.errors) ok(false, `FAIL alternatives table: ${e}`);
if (!v.errors.length) pass++;
for (const w of v.warnings) console.log(`WARN alternatives table: ${w}`);

// 2. The validator itself: a valid fixture passes; each broken fixture is caught.
const base = {
  id: "ALT-TEST", kinds: ["allergy_conflict"], drugClasses: ["nsaid"], consider: ["paracetamol"],
  note: { en: "Option for the prescriber to review, not a prescription.", it: "Opzione per il prescrittore, non una prescrizione.", th: "ทางเลือกให้แพทย์ผู้สั่งยาพิจารณา ไม่ใช่คำสั่งใช้ยา" },
  source: "BNF (British National Formulary), test fixture",
};
const fixture = (patch) => { const e = structuredClone(base); patch(e); return [e]; };
ok(validateAlternatives([base]).errors.length === 0, `FAIL validator: valid fixture rejected: ${validateAlternatives([base]).errors.join("; ")}`);
const broken = [
  ["missing table", undefined, /missing or empty/],
  ["unknown generic", fixture((e) => { e.consider = ["paracetamolx"]; }), /unknown generic "paracetamolx"/],
  ["unknown kind", fixture((e) => { e.kinds = ["allergy"]; }), /unknown kind "allergy"/],
  ["kind without alternative semantics", fixture((e) => { e.kinds = ["dose_range"]; }), /cannot carry alternatives/],
  ["empty consider", fixture((e) => { e.consider = []; }), /consider must be a non-empty array/],
  ["missing source", fixture((e) => { delete e.source; }), /source missing/],
  ["source without BNF/NICE/WHO/FDA/MHRA", fixture((e) => { e.source = "a blog post somewhere on the internet"; }), /source must cite/],
  ["unknown drugClass", fixture((e) => { e.drugClasses = ["nsaids"]; }), /unknown drugClass "nsaids"/],
  ["consider in its own drugClasses", fixture((e) => { e.consider = ["naproxen"]; }), /"naproxen" \(class nsaid\) is itself in drugClasses/],
  ["cephalosporin for penicillin allergy", fixture((e) => { e.drugClasses = ["penicillin"]; e.consider = ["cefalexin"]; }), /"cefalexin" conflicts with the triggering allergy class "penicillin" \(MR-ALLERGY-PEN-CEPH\)/],
  ["aspirin for NSAID allergy", fixture((e) => { e.consider = ["aspirin"]; }), /"aspirin" conflicts with the triggering allergy class "nsaid" \(MR-ALLERGY-NSAID\)/],
  ["pregnancy-flagged option", fixture((e) => { e.kinds = ["pregnancy_caution"]; e.consider = ["doxycycline"]; }), /"doxycycline" is itself pregnancy/],
  ["combination product", fixture((e) => { e.consider = ["paracetamol+codeine"]; }), /lay or combination entry/],
  ["instruction wording", fixture((e) => { e.note.en = "Switch to paracetamol for the prescriber to review, not a prescription."; }), /reads as an instruction/],
  ["missing framing", fixture((e) => { e.note.th = "พาราเซตามอล"; }), /note\.th must keep the claim-boundary framing/],
  ["unknown property", fixture((e) => { e.dose = "1 g"; }), /unknown property "dose"/],
  ["duplicate kind/class mapping", [base, { ...structuredClone(base), id: "ALT-TEST-2" }], /already mapped by ALT-TEST/],
];
for (const [name, table, want] of broken) {
  const got = validateAlternatives(table).errors;
  ok(got.some((m) => want.test(m)), `FAIL validator did not catch "${name}": got [${got.join("; ")}]`);
}

// 3. MEDRULES-TESTS.md rows.
const split = (s) => (s.trim() === "-" ? [] : s.split(";").map((x) => x.trim()).filter(Boolean));
for (const raw of md.split(/\r?\n/)) {
  const line = raw.trimEnd();
  let m = line.match(/^\| L \| (en|it|th) \| (.+?) \| (.+?) \|$/);
  if (m) {
    const got = lookup(m[2], R.drugs)?.generic ?? "(none)";
    ok(got === m[3], `FAIL lookup ${m[1]} "${m[2]}" expected=${m[3]} got=${got}`);
    continue;
  }
  m = line.match(/^\| AL \| (en|it|th) \| (.+?) \| (.+?) \|$/);
  if (m) {
    const got = lookup(m[2], R.allergens)?.allergenClass ?? "(none)";
    ok(got === m[3], `FAIL allergen ${m[1]} "${m[2]}" expected=${m[3]} got=${got}`);
    continue;
  }
  m = line.match(/^\| D \| (en|it|th) \| (!?MR-DOSE-(?:RANGE|UNCHECKED)) \| (.+?) \| ([\d.]+) \| ([\d.]+) \|$/);
  if (m) {
    const got = doseAlerts(m[3], Number(m[4]), Number(m[5])), want = !m[2].startsWith("!"), id = m[2].replace("!", "");
    ok(got.has(id) === want, `FAIL dose ${m[1]} expected ${m[2]} got [${[...got].join(", ")}] :: ${m[3]} ${m[4]} mg x${m[5]}`);
    continue;
  }
  m = line.match(/^\| ALT \| (en|it|th) \| (MR-[A-Z0-9-]+) \| (.+?) \| (.+?) \| (.+?) \| (pregnant|possible|no|-) \| (.+?) \|$/);
  if (m) {
    const [, lang, ruleId, ordered, others, alls, preg, expect] = m;
    const hit = prescribingAlternatives(ordered, split(others), split(alls), preg).find((a) => a.ruleId === ruleId);
    const want = split(expect).sort().join("; ") || "-";
    if (!hit) ok(false, `FAIL alternatives ${lang} ${ruleId} not raised on "${ordered}" :: others=${others} allergies=${alls} preg=${preg}`);
    else { const got = [...hit.alternatives].sort().join("; ") || "-"; ok(got === want, `FAIL alternatives ${lang} ${ruleId} on "${ordered}" expected=${want} got=${got} :: others=${others} allergies=${alls} preg=${preg}`); }
    continue;
  }
  m = line.match(/^\| A \| (en|it|th) \| (!?MR-[A-Z0-9-]+) \| (.+?) \| (.+?) \| (pregnant|possible|no|-) \|$/);
  if (!m) { if (/^\| (L|AL|D|A|ALT) \| (en|it|th) \|/.test(line)) ok(false, `FAIL unparsed test row (would be silently skipped): ${line}`); continue; }
  const [, lang, expect, meds, alls, preg] = m;
  const got = alerts(split(meds), split(alls), preg);
  const want = !expect.startsWith("!"), id = expect.replace("!", "");
  ok(got.has(id) === want, `FAIL alert ${lang} expected ${expect} got [${[...got].join(", ")}] :: meds=${meds} allergies=${alls} preg=${preg}`);
}
console.log(`${pass} passed, ${fail} failed · medrules ${R.version} · ${R.drugs.length} drugs, ${R.allergens.length} allergen classes, ${R.allergyConflicts.length} allergy rules, ${R.interactions.length} interactions, ${(R.alternatives ?? []).length} alternative entries`);
process.exit(fail ? 1 : 0);
