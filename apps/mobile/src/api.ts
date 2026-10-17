import type { AddTurnReq, CreateSessionReq, IntakeSession, Lang } from "@medx/shared";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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
export const addTurn = (id: string, text: string) =>
  post<IntakeSession>(`/api/sessions/${id}/turns`, { text } satisfies AddTurnReq);
