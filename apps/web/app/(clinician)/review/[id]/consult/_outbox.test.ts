// w20 fix: the consult page never falls back to sample logic for a real case, and unsaved lines are retried, in order.
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, getJson, routeMissing } from "../../_lib";
import { nextToSend, purgeSent, retryDelayMs, retryable, unsaved, type OutLine } from "./_outbox";

const line = (n: number, state: OutLine["state"], ackAt?: number): OutLine => ({ id: `local-${n}`, clientTurnId: `c${n}`, speaker: "patient", text: `line ${n}`, at: "2026-10-18T03:00:00.000Z", input: "voice", state, ...(ackAt ? { ackAt } : {}) });

afterEach(() => vi.unstubAllGlobals());

describe("getJson errors carry the status, so only a missing route means fixture mode", () => {
  const answer = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers })));
  it("503 from the shared store: an API error, retryable with Retry-After, never a missing route", async () => {
    answer(503, { error: "Shared store unavailable; this change may not have been saved.", code: "internal" }, { "Retry-After": "5" });
    const e = await getJson("/api/sessions/x/consult").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(HttpError);
    expect(e).toMatchObject({ status: 503, apiError: true, retryAfter: 5, message: expect.stringMatching(/^Shared store unavailable/) });
    expect(routeMissing(e)).toBe(false);
    expect(retryable(e)).toBe(true);
    expect(retryDelayMs(e)).toBe(5000);
  });
  it("404 'Session not found' is an API answer, not a missing route", async () => {
    answer(404, { error: "Session not found", code: "not_found" });
    const e = await getJson("/api/sessions/x/consult").catch((x: unknown) => x);
    expect(routeMissing(e)).toBe(false);
    expect(retryable(e)).toBe(false);
  });
  it("an HTML 404 (route not deployed) is the only missing route", async () => {
    answer(404, "<!doctype html><title>404</title>");
    expect(routeMissing(await getJson("/api/sessions/x/consult").catch((x: unknown) => x))).toBe(true);
  });
  it("a network error is retryable and not a missing route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const e = await getJson("/api/sessions/x/consult").catch((x: unknown) => x);
    expect(routeMissing(e)).toBe(false);
    expect(retryable(e)).toBe(true);
    expect(retryDelayMs(e)).toBe(4000);
  });
  it("a 4xx refusal is final; 429 and 408 retry", () => {
    expect(retryable(new HttpError("Invalid", 400, true, null))).toBe(false);
    expect(retryable(new HttpError("Conflict", 409, true, null))).toBe(false);
    expect(retryable(new HttpError("Too many", 429, true, 60))).toBe(true);
    expect(retryDelayMs(new HttpError("Too many", 429, true, 60))).toBe(30000);
    expect(retryable(new HttpError("Timeout", 408, false, null))).toBe(true);
  });
});

describe("outbox order and display", () => {
  it("sends the oldest unsaved line first and skips saved or refused ones", () => {
    const lines = [line(1, "sent", 10), line(2, "refused"), line(3, "unsent"), line(4, "sending")];
    expect(nextToSend(lines)?.clientTurnId).toBe("c3");
    expect(unsaved(lines).map((l) => l.clientTurnId)).toEqual(["c2", "c3", "c4"]);
    expect(nextToSend([line(1, "sent", 10)])).toBeUndefined();
  });
  it("a saved line leaves the outbox only after a session reload that started after the save", () => {
    const lines = [line(1, "sent", 100), line(2, "sent", 300), line(3, "unsent")];
    expect(purgeSent(lines, 200).map((l) => l.clientTurnId)).toEqual(["c2", "c3"]);
  });
});
