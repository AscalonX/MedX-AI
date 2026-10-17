// Reference NEWS2 scorer + triage-level mapper for packages/shared/src/vitalrules.json (CONSULT-SPEC §9).
// Usage: node docs/clinical/check-vitalrules.mjs   (exit 1 on any failing case)
import { readFileSync } from "node:fs";
const V = JSON.parse(readFileSync(new URL("../../packages/shared/src/vitalrules.json", import.meta.url), "utf8"));

const ORDINAL = { alert: 0, new_confusion: 1, voice: 2, pain: 3, unresponsive: 4 };
const PARAMS = ["respRate", "spo2", "onOxygen", "systolicBP", "heartRate", "consciousness", "tempC"];
const value = (v, k) => {
  const x = v[k];
  if (x == null) return null;
  if (k === "consciousness") return ORDINAL[x];
  if (k === "onOxygen") return x ? 1 : 0;
  return k === "tempC" ? Math.round(x * 10) / 10 : Math.round(x); // bands are inclusive at the recorded resolution
};

export function assess(vitals, { emergency = false, urgent = false } = {}) {
  const hits = [];
  for (const k of PARAMS) {
    const x = value(vitals, k); if (x == null) continue;
    const b = V.bands.find((b) => b.vital === k && (b.min == null || x >= b.min) && (b.max == null || x <= b.max));
    if (!b) throw new Error(`no band for ${k}=${x}`);
    hits.push(b);
  }
  const complete = hits.length === PARAMS.length;
  const score = complete ? hits.reduce((s, b) => s + b.points, 0) : undefined;
  const maxBand = Math.max(0, ...hits.map((b) => b.points));
  for (const l of V.levels) {
    const w = l.when;
    if (w.anyEmergencyRedFlag && !emergency) continue;
    if (w.anyUrgentRedFlag && !urgent) continue;
    if (w.minScore != null && !(score != null && score >= w.minScore)) continue;
    if (w.anySingleBandPoints != null && !(maxBand >= w.anySingleBandPoints)) continue;
    // Incomplete vitals never fall through to the reassuring default: engine constant level 3 (CONSULT-SPEC §9).
    if (Object.keys(w).length === 0 && !complete) return { level: 3, score, alerts: hits.filter((b) => b.alert).map((b) => b.alert.ruleId) };
    return { level: l.level, score, alerts: hits.filter((b) => b.alert).map((b) => b.alert.ruleId) };
  }
}

const N = { respRate: 16, spo2: 98, onOxygen: false, systolicBP: 120, heartRate: 70, consciousness: "alert", tempC: 37.0 };
const cases = [
  ["all normal", N, {}, 4, 0],
  ["score 6 → level 2", { ...N, respRate: 22, spo2: 95, systolicBP: 105, heartRate: 105, tempC: 38.5 }, {}, 2, 6],
  ["new confusion alone (single 3) → level 2", { ...N, consciousness: "new_confusion" }, {}, 2, 3],
  ["score 1 → level 3", { ...N, heartRate: 95 }, {}, 3, 1],
  ["score 4 → level 3", { ...N, respRate: 22, heartRate: 95, tempC: 38.2 }, {}, 3, 4],
  ["very unwell, no red flag → level 2", { respRate: 26, spo2: 90, onOxygen: true, systolicBP: 88, heartRate: 135, consciousness: "pain", tempC: 39.5 }, {}, 2, 19],
  ["emergency red flag wins", N, { emergency: true }, 1, 0],
  ["urgent red flag, normal vitals → 2", N, { urgent: true }, 2, 0],
  ["temp 35.0 → 3 points (single 3) → 2", { ...N, tempC: 35.0 }, {}, 2, 3],
  ["temp 36.0 → 1 point → 3", { ...N, tempC: 36.0 }, {}, 3, 1],
  ["SBP 220 → 3 → 2", { ...N, systolicBP: 220 }, {}, 2, 3],
  ["incomplete vitals, nothing abnormal → 3 (never 4)", { heartRate: 80, tempC: 37.1 }, {}, 3, undefined],
  ["incomplete vitals with SpO2 88 → 2", { spo2: 88 }, {}, 2, undefined],
];
let fail = 0;
for (const [name, v, rf, level, score] of cases) {
  const r = assess(v, rf);
  if (r.level !== level || r.score !== score) { fail++; console.log(`FAIL ${name}: got level ${r.level} score ${r.score}, want ${level}/${score}`); }
}
// Every numeric parameter must be covered without gaps at its recorded resolution.
for (const [k, lo, hi, step] of [["respRate", 0, 60, 1], ["spo2", 50, 100, 1], ["systolicBP", 40, 300, 1], ["heartRate", 20, 250, 1], ["tempC", 30, 43, 0.1]])
  for (let x = lo; x <= hi + 1e-9; x += step) { const y = k === "tempC" ? Math.round(x * 10) / 10 : x;
    if (V.bands.filter((b) => b.vital === k && (b.min == null || y >= b.min) && (b.max == null || y <= b.max)).length !== 1) { fail++; console.log(`FAIL band coverage ${k}=${y}`); break; } }
console.log(`${cases.length - fail >= 0 ? cases.length : 0} cases + band coverage: ${fail ? fail + " failed" : "all passed"}`);
process.exit(fail ? 1 : 0);
