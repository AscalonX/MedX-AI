import { tr, type TKey } from "./_i18n";
import type {
  AuditEvent, FieldKey, GetSessionRes, IntakeSession, IntakeSummary, Lang, Localized, RedFlagHit, SessionStatus,
} from "@medx/shared";

export const LANG_OPTIONS: { lang: Lang; label: string }[] = [
  { lang: "th", label: "ไทย" },
  { lang: "it", label: "Italiano" },
  { lang: "en", label: "English" },
];
export const LANG_NAME: Record<Lang, string> = { th: "ไทย", it: "Italiano", en: "English" };

/** Local stand-in for sign-in. Prototype only: no authentication. */
export const NURSES = ["Nurse A. Rossi", "Nurse K. Suwan"];
export const DOCTORS = ["Dr. M. Bianchi", "Dr. S. Chaiyo"];
export const REVIEWERS = [...NURSES, ...DOCTORS];
export const reviewersFor = (role: "nurse" | "doctor") => (role === "doctor" ? DOCTORS : NURSES);

export const L = (th: string, it: string, en: string): Localized => ({ th, it, en });

export const FIELD_LABEL: Record<FieldKey, Localized> = {
  chief_complaint: L("อาการสำคัญ", "Motivo della visita", "Chief complaint"),
  onset: L("เริ่มมีอาการ", "Esordio", "Onset"),
  duration: L("ระยะเวลา", "Durata", "Duration"),
  severity: L("ความรุนแรง", "Intensità", "Severity"),
  location: L("ตำแหน่ง", "Sede", "Location"),
  associated_symptoms: L("อาการร่วม", "Sintomi associati", "Associated symptoms"),
  medications: L("ยาที่ใช้", "Farmaci", "Medications"),
  allergies: L("การแพ้", "Allergie", "Allergies"),
  medical_history: L("ประวัติการรักษา", "Anamnesi", "Medical history"),
  pregnancy_status: L("การตั้งครรภ์", "Gravidanza", "Pregnancy status"),
  age: L("อายุ", "Età", "Age"),
  sex: L("เพศ", "Sesso", "Sex"),
};

/** Order follows docs/clinical/SPEC.md section 4: complaint, patient, safety block, present illness, background. */
export const FIELD_GROUPS: { id: string; title: Localized; keys: FieldKey[] }[] = [
  { id: "complaint", title: FIELD_LABEL.chief_complaint, keys: ["chief_complaint"] },
  { id: "patient", title: L("ผู้ป่วย", "Paziente", "Patient"), keys: ["age", "sex"] },
  { id: "safety", title: L("ความปลอดภัย", "Sicurezza", "Safety"), keys: ["allergies", "medications", "pregnancy_status"] },
  { id: "illness", title: L("อาการปัจจุบัน", "Malattia attuale", "Present illness"), keys: ["onset", "duration", "severity", "location", "associated_symptoms"] },
  { id: "background", title: L("ภูมิหลัง", "Contesto", "Background"), keys: ["medical_history"] },
];

export const ABSTAIN_REASON: Record<NonNullable<IntakeSummary["abstainReason"]>, string> = {
  provider_error: "The model service did not answer.",
  schema_error: "The model answer could not be checked.",
  low_confidence: "The patient's words were not enough to fill the required fields with confidence.",
  unsupported_language: "The text is not in Thai, Italian or English, or could not be read.",
  out_of_scope: "This looks outside what this intake is for.",
  conflicting_information: "The patient said things that contradict each other.",
};

export const STEP_LABEL: Record<string, string> = {
  redact: "redact", red_flags: "red flag screen", extract: "extract", verify: "verify", translate: "translate", next_question: "next question",
};

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const fetchQueue = () => getJson<IntakeSession[]>("/api/sessions");
export const fetchSession = (id: string) => getJson<GetSessionRes>(`/api/sessions/${id}`);
export const post = <T,>(url: string, body: unknown) =>
  getJson<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function topSeverity(s: IntakeSession): "emergency" | "urgent" | null {
  const hits = s.summary?.redFlags ?? [];
  if (hits.some((h) => h.severity === "emergency")) return "emergency";
  return hits.length ? "urgent" : null;
}
export const unreviewed = (hits: RedFlagHit[]) => hits.filter((h) => !h.review);

const RANK: Record<SessionStatus, number> = { escalated: 0, awaiting_review: 1, needs_human: 2, collecting: 3, taken_over: 4, approved: 5 };
/** Escalated pinned first (emergency before urgent), then by status, then longest wait first. */
export function sortQueue(list: IntakeSession[]): IntakeSession[] {
  const sev = (s: IntakeSession) => (topSeverity(s) === "emergency" ? 0 : 1);
  return [...list].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || (a.status === "escalated" ? sev(a) - sev(b) : 0) || a.createdAt.localeCompare(b.createdAt),
  );
}

export const cap = (l: Localized): Localized => ({ th: l.th, it: l.it.charAt(0).toUpperCase() + l.it.slice(1), en: l.en.charAt(0).toUpperCase() + l.en.slice(1) });

export function waited(fromIso: string, now: number, unit = "min"): string {
  const min = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 60000));
  if (min < 60) return `${min} ${unit}`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h ${min % 60} ${unit}` : `${Math.floor(h / 24)} d`;
}
const LOCALE: Record<Lang, string> = { th: "th-TH", it: "it-IT", en: "en-GB" };
/** 24-hour time in the UI language's locale. */
export const clock = (iso: string, lang: Lang = "en") =>
  new Intl.DateTimeFormat(LOCALE[lang], { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

export const STATUS_LABEL: Record<SessionStatus, string> = {
  collecting: "Collecting", escalated: "Escalated", awaiting_review: "Review", needs_human: "Needs human review", approved: "Approved", taken_over: "Taken over",
};

export function auditLine(e: AuditEvent, lang: Lang): string {
  const p = e.payload as Record<string, unknown>;
  const acts = (x: unknown) =>
    Array.isArray(x)
      ? x.map((a: { fieldKey?: FieldKey; ruleId?: string; action?: string }) => {
          const verb = a.action === "approve" ? tr("approve", lang) : a.action === "edit" ? tr("edit", lang) : a.action === "reject" ? tr("reject", lang) : a.action === "acknowledge" ? tr("acknowledged", lang) : a.action === "false_alarm" ? tr("falseAlarm", lang) : "";
          return `${verb} ${a.fieldKey ? FIELD_LABEL[a.fieldKey]?.[lang] ?? "" : a.ruleId ?? ""}`.trim();
        }).join(", ")
      : "";
  switch (e.type) {
    case "review": return `${tr("au_review", lang)}: ${acts(p.actions)}`;
    case "red_flag_review": return `${tr("au_flag_review", lang)}: ${acts(p.actions)}`;
    case "red_flag": return `${tr("au_red_flag", lang)}${typeof p.ruleId === "string" ? `: ${p.ruleId}` : ""}`;
    case "abstained": {
      const r = String(p.reason ?? "");
      return `${tr("au_abstained", lang)}: ${r in ABSTAIN_KEYS ? tr(ABSTAIN_KEYS[r], lang) : ""}`.replace(/: $/, "");
    }
    case "takeover": return tr("au_takeover", lang);
    case "summary_generated": return tr("au_summary", lang);
    case "pii_redacted": return tr("au_pii", lang);
    case "session_created": return tr("au_created", lang);
    case "turn_added": return tr("au_turn", lang);
    default: return "";
  }
}
const ABSTAIN_KEYS: Record<string, TKey> = {
  provider_error: "ar_provider_error", schema_error: "ar_schema_error", low_confidence: "ar_low_confidence",
  unsupported_language: "ar_unsupported_language", out_of_scope: "ar_out_of_scope", conflicting_information: "ar_conflicting_information",
};
