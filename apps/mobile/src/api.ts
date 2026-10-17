import { Platform } from "react-native";
import type { AddTurnReq, CreateSessionReq, IntakeSession, Lang } from "@medx/shared";

// Web (served under /patient by the Next app) defaults to same-origin; native defaults to the local API.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === "web" ? "" : "http://localhost:3000");

// Server allows 40 s per turn (header x-medx-timeout-ms: 40000); the client waits 45 s so a valid slow turn is not reported as failed.
const TIMEOUT_MS = 45000;
export const isTimeout = (e: unknown) => (e as { name?: string })?.name === "AbortError";

export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); });
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const createSession = (patientLang: Lang) =>
  post<IntakeSession>("/api/sessions", { patientLang } satisfies CreateSessionReq);
/** clientTurnId lets the server dedupe: a retry with the same id never appends the answer twice. */
export const addTurn = (id: string, text: string, inputMode: "text" | "voice" = "text", clientTurnId?: string) =>
  post<IntakeSession>(`/api/sessions/${id}/turns`, { text, inputMode, clientTurnId } satisfies AddTurnReq);

export async function getSession(id: string): Promise<{ session: IntakeSession; reviewedAt: string | null }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${BASE}/api/sessions/${id}`, { signal: ctl.signal });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    const j = (await r.json()) as { session: IntakeSession; audit?: { type: string; at: string }[] };
    const rev = (j.audit ?? []).filter((a) => a.type === "review" || a.type === "takeover").pop();
    return { session: j.session, reviewedAt: rev?.at ?? null };
  } finally {
    clearTimeout(t);
  }
}
