import { Platform } from "react-native";
import type { AddTurnReq, CreateSessionReq, Lang, Localized, RedFlagSeverity, SessionStatus } from "@medx/shared";

/** Medicine pickup as the patient sees it: a status and the counter only. Never drug names, pharmacist ids, notes or times. */
export type PickupStatus = "preparing" | "ready" | "collected";
export type PatientPickup = { status: PickupStatus; counter?: string } | null;

/** The server projection for patients (GET ?view=patient / POST with x-medx-client: patient). The app never needs, and never keeps, clinician data. */
export interface PatientView {
  id: string; code: string; patientLang: Lang; status: SessionStatus;
  turns: { id: string; role: "patient" | "assistant"; text: string; at?: string; inputMode?: "text" | "voice" }[];
  summary: null | { nextQuestion: { field: string; text: Localized } | null; redFlags: { patientMessage: Localized; severity: RedFlagSeverity }[]; abstained: boolean };
  /** null until a prescription is sent to the pharmacy (older servers and stored copies: missing, read as null). */
  pickup: PatientPickup;
  /** One boolean, never who or what: staff acted on the case (intake approved or taken over, triage confirmed, or a note signed). Older servers: false. */
  seenByStaff: boolean;
}

const PICKUP: readonly PickupStatus[] = ["preparing", "ready", "collected"];
/** Whitelist the pickup object: a known status and a short counter label, nothing else. */
function toPickup(p: unknown): PatientPickup {
  if (!p || typeof p !== "object") return null;
  const { status, counter } = p as { status?: unknown; counter?: unknown };
  if (!PICKUP.includes(status as PickupStatus)) return null;
  const c = typeof counter === "string" ? counter.trim().slice(0, 40) : "";
  return { status: status as PickupStatus, ...(c ? { counter: c } : {}) };
}

/** Whitelist: drop anything else the server (or an old stored copy) might carry. */
export function toPatient(x: PatientView): PatientView {
  const sm = x.summary;
  return {
    id: x.id, code: x.code, patientLang: x.patientLang, status: x.status,
    turns: (x.turns ?? []).filter((t) => t.role === "patient").map((t) => ({ id: t.id, role: "patient", text: t.text, at: t.at, inputMode: t.inputMode })),
    summary: sm ? { nextQuestion: sm.nextQuestion ? { field: sm.nextQuestion.field, text: sm.nextQuestion.text } : null, redFlags: (sm.redFlags ?? []).map((r) => ({ patientMessage: r.patientMessage, severity: r.severity })), abstained: !!sm.abstained } : null,
    pickup: toPickup(x.pickup),
    seenByStaff: x.seenByStaff === true,
  };
}

/** Medicine is on its way or waiting at the counter: the visit is not over, so the phone must keep this session. */
export const pickupPending = (s: PatientView | null | undefined) => s?.pickup?.status === "preparing" || s?.pickup?.status === "ready";

// Web (served under /patient by the Next app) defaults to same-origin; native defaults to the local API.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === "web" ? "" : "http://localhost:3000");

// Server allows 52 s per turn (header x-medx-timeout-ms: 52000); the client waits 58 s so a valid slow turn is not reported as failed.
const TIMEOUT_MS = 58000;
export const isTimeout = (e: unknown) => (e as { name?: string })?.name === "AbortError";

export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); });
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST", headers: { "content-type": "application/json", "x-medx-client": "patient" }, body: JSON.stringify(body), signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const createSession = (patientLang: Lang) =>
  post<PatientView>("/api/sessions", { patientLang } satisfies CreateSessionReq).then(toPatient);
/** clientTurnId lets the server dedupe: a retry with the same id never appends the answer twice. */
export const addTurn = (id: string, text: string, inputMode: "text" | "voice" = "text", clientTurnId?: string) =>
  post<PatientView>(`/api/sessions/${id}/turns`, { text, inputMode, clientTurnId } satisfies AddTurnReq).then(toPatient);

export async function getSession(id: string): Promise<{ session: PatientView }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${BASE}/api/sessions/${id}?view=patient`, { signal: ctl.signal });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    const j = (await r.json()) as { session: PatientView };
    return { session: toPatient(j.session) };
  } finally {
    clearTimeout(t);
  }
}

/** Read-aloud audio (mp3) for text the server itself produced. Rejects on any failure so the caller can use the device voice. */
export async function fetchSpeech(req: { kind: "first_question" | "next_question" | "red_flag"; lang: Lang; sessionId?: string }, signal?: AbortSignal): Promise<ArrayBuffer> {
  const r = await fetch(`${BASE}/api/tts`, { method: "POST", headers: { "content-type": "application/json", "x-medx-client": "patient" }, body: JSON.stringify(req), signal });
  if (!r.ok || !(r.headers.get("content-type") ?? "").includes("audio")) throw new Error(`TTS HTTP ${r.status}`);
  return r.arrayBuffer();
}
