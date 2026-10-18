// Consult lines not yet saved by the server (w20 fix): pure helpers, unit tested in _outbox.test.ts.
// A spoken or typed line is always POSTed with its clientTurnId (the server dedupes on it, so a retry is safe).
// Until the server answers 200 the line is shown as "not saved", never as part of the record.
import { HttpError } from "../../_lib";
import type { Line } from "./_fixture";

export type OutState = "sending" | "unsent" | "refused" | "sent";
export interface OutLine extends Line { clientTurnId: string; state: OutState; input: "text" | "voice"; ackAt?: number; error?: string }

/** The oldest line still to send (order is kept: a later line never overtakes an earlier unsent one). */
export const nextToSend = (lines: readonly OutLine[]) => lines.find((l) => l.state === "sending" || l.state === "unsent");

/** Lines the server has not saved: shown with a "not saved" chip and counted in the banner. */
export const unsaved = (lines: readonly OutLine[]) => lines.filter((l) => l.state !== "sent");

/** Worth retrying: network errors, 5xx (shared store busy or unavailable), 408, 425 and 429. A 4xx refusal is final. */
export function retryable(e: unknown): boolean {
  if (!(e instanceof HttpError)) return true;
  return e.status >= 500 || e.status === 408 || e.status === 425 || e.status === 429;
}

/** Wait before the next attempt: the server's Retry-After when given (1 to 30 s), else 4 s (one poll). */
export function retryDelayMs(e: unknown): number {
  const s = e instanceof HttpError && e.retryAfter ? e.retryAfter : 4;
  return Math.min(30, Math.max(1, s)) * 1000;
}

/** After a session reload that started at `startedAt`, sent lines acknowledged before it are in the record: drop them. */
export const purgeSent = (lines: readonly OutLine[], startedAt: number) => lines.filter((l) => !(l.state === "sent" && (l.ackAt ?? 0) <= startedAt));
