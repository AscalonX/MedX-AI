import { staffFor } from "@medx/shared/src/staff";
import { fmt, tr, type TKey } from "./_i18n";
import type {
  AuditEvent, FieldKey, GetSessionRes, IntakeSession, IntakeSummary, InvestigationOrder, Lang, Localized, MedicationOrder, RedFlagHit, SessionListItem, SessionStatus,
} from "@medx/shared";

export const LANG_OPTIONS: { lang: Lang; label: string }[] = [
  { lang: "th", label: "ไทย" },
  { lang: "it", label: "Italiano" },
  { lang: "en", label: "English" },
];
export const LANG_NAME: Record<Lang, string> = { th: "ไทย", it: "Italiano", en: "English" };

/** Local stand-in for sign-in. Prototype only: no authentication. */
export const reviewersFor = (role: "nurse" | "doctor") => staffFor(role).map((m) => m.name);
export const REVIEWERS = [...reviewersFor("nurse"), ...reviewersFor("doctor")];

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

/** A failed API call: the HTTP status, whether the server answered with an API error body, and Retry-After (s). */
export class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly apiError: boolean, readonly retryAfter: number | null) { super(message); this.name = "HttpError"; }
}
/**
 * True only when the route itself is missing on this server (404/405 without an API error body, e.g. an older deploy).
 * A 404 "Session not found", a 5xx, a 503 "Shared store unavailable" or a network error is never "missing".
 */
export const routeMissing = (e: unknown) => e instanceof HttpError && (e.status === 404 || e.status === 405) && !e.apiError;

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const retry = Number(res.headers?.get?.("Retry-After"));
    throw new HttpError(body?.error ?? `Request failed (${res.status})`, res.status, typeof body?.error === "string", Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return body as T;
}

/** GET /api/sessions rows carry the server-derived journey `stage`. */
export const fetchQueue = () => getJson<SessionListItem[]>("/api/sessions");
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
/** Confirmed triage level, 1 most urgent; a case without a confirmed level sorts after every confirmed one. */
const triageRank = (s: IntakeSession) => s.triage?.confirmed?.level ?? 6;
/**
 * Escalated pinned first (emergency before urgent), then by status. Inside every other status group: confirmed
 * triage level, most urgent first (S-01), then the longest wait first. The order is a reading aid; it never hides a case.
 */
export function sortQueue<T extends IntakeSession>(list: T[]): T[] {
  const sev = (s: IntakeSession) => (topSeverity(s) === "emergency" ? 0 : 1);
  return [...list].sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      (a.status === "escalated" ? sev(a) - sev(b) : triageRank(a) - triageRank(b)) ||
      a.createdAt.localeCompare(b.createdAt),
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

/** Orders behind an event's orderId, so a line can name the drug or test (never notes or report text). */
export interface AuditCtx { medications?: MedicationOrder[]; investigations?: InvestigationOrder[] }

/** Who did it: the staff name for clinician actions, otherwise Patient or System. */
export const auditActor = (e: AuditEvent, lang: Lang) => e.actorId ?? tr(`actor_${e.actor}` as TKey, lang);

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim() : null);
const list = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string" && !!v.trim()) : []);
/** Vital signs as short, language-neutral abbreviations (the same on every chart). */
const VITAL_PARTS: ((v: Record<string, unknown>) => string | null)[] = [
  (v) => (num(v.heartRate) !== null ? `HR ${v.heartRate}` : null),
  (v) => (num(v.systolicBP) !== null && num(v.diastolicBP) !== null ? `BP ${v.systolicBP}/${v.diastolicBP}` : null),
  (v) => (num(v.respRate) !== null ? `RR ${v.respRate}` : null),
  (v) => (num(v.tempC) !== null ? `T ${v.tempC} °C` : null),
  (v) => (num(v.spo2) !== null ? `SpO2 ${v.spo2}%` : null),
];

/**
 * One plain line per audit event, in the UI language (S-02). Every AuditType has a label, and key fields are named:
 * triage level, drug generic, override count, the verifying pharmacist, the pickup counter. Free text (notes,
 * reasons, report notes, patient words) never appears here; it stays on the page that owns it.
 * The actor is shown beside the line (`auditActor`, `auditRow`).
 */
export function auditLine(e: AuditEvent, lang: Lang, ctx: AuditCtx = {}): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const t = (k: TKey, v?: Record<string, string | number>) => (v ? fmt(tr(k, lang), v) : tr(k, lang));
  const med = (id: unknown) => {
    const o = typeof id === "string" ? ctx.medications?.find((m) => m.id === id) : undefined;
    return o ? o.generic || o.drugText : t("au_a_medicine");
  };
  const acts = (x: unknown) =>
    Array.isArray(x)
      ? x.map((a: { fieldKey?: FieldKey; ruleId?: string; action?: string }) => {
          const verb = a.action === "approve" ? tr("approve", lang) : a.action === "edit" ? tr("edit", lang) : a.action === "reject" ? tr("reject", lang) : a.action === "acknowledge" ? tr("acknowledged", lang) : a.action === "false_alarm" ? tr("falseAlarm", lang) : "";
          return `${verb} ${a.fieldKey ? FIELD_LABEL[a.fieldKey]?.[lang] ?? "" : a.ruleId ?? ""}`.trim();
        }).filter(Boolean).join(", ")
      : "";
  // "Head: a, b". When the head or a part already has a colon, the parts follow after a comma instead.
  const withParts = (head: string, parts: (string | null | false | undefined)[]) => {
    const kept = parts.filter((x): x is string => !!x);
    if (!kept.length) return head;
    return `${head}${head.includes(":") || kept.some((x) => x.includes(":")) ? ", " : ": "}${kept.join(", ")}`;
  };
  const mode = (m: unknown) => (m === "doctor" ? t("au_mode_doctor") : m === "nurse" ? t("au_mode_nurse") : "");
  switch (e.type) {
    case "session_created": {
      const l = p.patientLang;
      const head = l === "th" || l === "it" || l === "en" ? t("au_created_in", { lang: LANG_NAME[l] }) : t("au_created");
      return p.demoStart || p.demoCaseId ? `${head}, ${t("au_demo_case")}` : head;
    }
    case "turn_added":
      return p.inputMode === "voice" || p.inputMode === "text" ? t("au_turn_mode", { mode: t(p.inputMode === "voice" ? "au_spoken" : "au_typed") }) : t("au_turn");
    case "pii_redacted": {
      // Engine shape: replaced = [{ type, count }]; the line gives the total, never the redacted values.
      const n = Array.isArray(p.replaced) ? p.replaced.reduce<number>((sum, r) => sum + (r && typeof r === "object" ? num((r as { count?: unknown }).count) ?? 1 : 1), 0) : 0;
      return n > 0 ? t("au_pii_n", { n }) : t("au_pii");
    }
    case "red_flag": {
      const rules = [...list(p.ruleIds), ...list([p.ruleId])];
      return withParts(t("au_red_flag"), [rules.join(", ")]);
    }
    case "summary_generated": {
      if (p.event === "consult_note_drafted") return t("au_note_drafted", { mode: mode(p.mode) || "-", n: num(p.lineCount) ?? 0 });
      if (p.event === "field_review_change") {
        const k = str(p.key) as FieldKey | null;
        return t("au_field_change", { field: k && FIELD_LABEL[k] ? FIELD_LABEL[k][lang] : "-" });
      }
      if (typeof p.event === "string") return t("au_summary_event");
      const auto = num(p.autoCaptured), req = num(p.required);
      return auto !== null && req !== null ? t("au_summary_fields", { auto, required: req }) : t("au_summary");
    }
    case "abstained": {
      const r = String(p.reason ?? "");
      return withParts(t(p.stage === "consult" ? "au_abstained_consult" : "au_abstained"), [r in ABSTAIN_KEYS ? tr(ABSTAIN_KEYS[r], lang) : null]);
    }
    case "review": return withParts(t("au_review"), [acts(p.actions)]);
    case "red_flag_review": return withParts(t("au_flag_review"), [acts(p.actions)]);
    case "takeover": return t("au_takeover");
    case "pharmacy_review": {
      const n = [p.medActions, p.allergyActions, p.alertActions].reduce<number>((a, x) => a + (Array.isArray(x) ? x.length : 0), 0);
      return withParts(t("au_pharmacy_review"), [n > 0 && t("au_items_n", { n }), p.complete === true && t("au_signed_off")]);
    }
    case "med_photo_suggested": return t(p.outcome === "suggested" ? "au_med_photo" : "au_med_photo_none");
    case "med_photo_decision": return t(p.action === "confirm" ? "au_med_photo_ok" : "au_med_photo_no");
    case "consult_turn": {
      const who = p.speaker === "patient" ? tr("actor_patient", lang) : tr("actor_clinician", lang);
      const input = p.inputMode === "voice" ? t("au_spoken") : t("au_typed");
      return withParts(t("au_consult_turn"), [who, input, mode(p.mode)]);
    }
    case "consult_suggestion": {
      const id = str(p.suggestionId) ?? "";
      const rule = id.split(":").find((x) => /^[A-Z]{2,}-[A-Z0-9-]+$/.test(x)) ?? null;
      const key: TKey = p.status === "dismissed" ? "au_sugg_dismissed" : p.status === "answered" ? "au_sugg_answered" : id.startsWith("consider:") ? "au_sugg_kept" : "au_sugg_asked";
      return withParts(t(key), [rule]);
    }
    case "consult_note_signed":
      return t("au_note_signed", { mode: mode(p.mode) || "-", n: num(p.lineCount) ?? 0, kept: list(p.keptConsiderationIds).length, edited: list(p.editedLineIds).length });
    case "vitals_recorded": {
      const v = (p.vitals && typeof p.vitals === "object" ? p.vitals : {}) as Record<string, unknown>;
      const values = VITAL_PARTS.map((f) => f(v)).filter(Boolean).join(", ");
      const n = num(p.suggestedLevel);
      if (n !== null) return t(values ? "au_vitals" : "au_vitals_plain", { values, n });
      return withParts(t("au_vitals_head"), [values]);
    }
    case "triage_confirmed": {
      const n = num(p.level), s = num(p.suggestedLevel);
      return n === null ? t("au_triage_plain") : s !== null ? t("au_triage", { n, s }) : t("au_triage_n", { n });
    }
    case "order_drafted":
      if (p.action === "cancel") return t("au_cancelled_drug", { drug: med(p.orderId) });
      return t(p.updated === true ? "au_redrafted" : "au_drafted", { drug: med(p.orderId) });
    case "order_submitted": {
      if (p.kind === "investigation") {
        const inv = typeof p.orderId === "string" ? ctx.investigations?.find((o) => o.id === p.orderId) : undefined;
        return t("au_investigation_x", { what: inv?.label[lang] || str(p.code) || "-" });
      }
      const overrides = Array.isArray(p.overrides) ? p.overrides.length : 0;
      return withParts(t("au_order_submitted_drug", { drug: med(p.orderId) }), [overrides > 0 && t("au_overrides", { n: overrides }), p.pickupReset === true && t("au_pickup_reset")]);
    }
    case "order_pharmacy_action": {
      const report = (p.report && typeof p.report === "object" ? p.report : {}) as { suggestedGenerics?: unknown };
      const options = [...new Set(list(report.suggestedGenerics))];
      const head = t(p.action === "return" ? "au_returned_drug" : "au_verified_drug", { drug: med(p.orderId) });
      return withParts(head, [p.action === "return" && options.length > 0 && t("au_options", { list: options.join(", ") }), p.afterRecheck === true && t("au_after_recheck")]);
    }
    case "order_dispensed": return t("au_dispensed_drug", { drug: med(p.orderId), verifiedBy: str(p.verifiedBy) ?? "-" });
    case "order_cancelled": return t("au_cancelled_drug", { drug: med(p.orderId) });
    case "order_recheck": {
      const rules = list(p.ruleIds);
      return `${t("au_recheck", { drug: med(p.orderId) })}${rules.length ? ` (${rules.join(", ")})` : ""}`;
    }
    case "pickup_called": {
      const c = str(p.counter);
      return c ? t(p.recall === true ? "au_pickup_recalled_at" : "au_pickup_called_at", { counter: c }) : t(p.recall === true ? "au_pickup_recalled" : "au_pickup_called");
    }
    case "pickup_collected": {
      const by = str(p.calledBy);
      return by ? t("au_collected_by", { who: by }) : t("au_pickup_collected");
    }
    default: {
      // A type added to the contract before it gets a label still reads as words, never as an empty row.
      const other: string = e.type;
      return `${t("au_other")}: ${other.replace(/_/g, " ")}`;
    }
  }
}

/** Actor and line for one audit row. */
export const auditRow = (e: AuditEvent, lang: Lang, ctx: AuditCtx = {}) => ({ who: auditActor(e, lang), text: auditLine(e, lang, ctx) });
const ABSTAIN_KEYS: Record<string, TKey> = {
  provider_error: "ar_provider_error", schema_error: "ar_schema_error", low_confidence: "ar_low_confidence",
  unsupported_language: "ar_unsupported_language", out_of_scope: "ar_out_of_scope", conflicting_information: "ar_conflicting_information",
};
