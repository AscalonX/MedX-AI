import { Platform } from "react-native";
import type { AddTurnReq, CreateSessionReq, IntakeSession, Lang } from "@medx/shared";

// Web (served under /patient by the Next app) defaults to same-origin; native defaults to the local API.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === "web" ? "" : "http://localhost:3000");

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000); // slow model must never hang the screen
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
export const addTurn = (id: string, text: string, inputMode: "text" | "voice" = "text") =>
  post<IntakeSession>(`/api/sessions/${id}/turns`, { text, inputMode } satisfies AddTurnReq);

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
