import {
  DEMO_PERSONAS,
  ROLE_STORAGE_KEY,
  reviewerStorageKey,
  type DemoCasesRes,
  type DemoPersona,
  type DemoPersonaId,
  type DemoStartRes,
  type Lang,
} from "@medx/shared";
import { DEMO_CASE_KEY } from "../_shared/demoPersona";
import { PATIENT_PATH } from "./site";

/**
 * Same value as CLINICIAN_ROLE_KEY in app/_shared/useStaffRole.ts (a test keeps them equal). Not imported from there:
 * that module is a client module, and this file is also used by server components.
 */
export const CLINICIAN_ROLE_KEY = "medx.clinicianRole";

/*
 * "Try a role" (landing and /demo): each persona card opens /demo/<persona id>, which records the demo identity in
 * localStorage (the same keys every staff surface reads) and then opens that persona's synthetic case.
 * Pure helpers, so they are unit tested; the page only wires them to the browser.
 */

/** Which demo persona the visitor last chose (read by nothing critical; kept for the video and QA). */
export const DEMO_PERSONA_KEY = "medx.demo.persona";

export function personaById(id: string | undefined | null): DemoPersona | undefined {
  return DEMO_PERSONAS.find((p) => p.id === id);
}

/** Initials for the persona disc ("Pharmacist Laura Conti" gives "LC"; the patient gets none). */
export function personaInitials(p: DemoPersona): string {
  if (!p.staffName) return "";
  const words = p.staffName.replace(/^(Head Nurse|Nurse|Dr\.?|Pharmacist)\s+/i, "").split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * localStorage writes for a persona, in order. Staff personas set the shared role key, the per-role identity, and
 * for nurse or doctor the clinician role the review screens restore. The patient only records the persona.
 */
export function personaStorage(p: DemoPersona): [key: string, value: string][] {
  const out: [string, string][] = [[DEMO_PERSONA_KEY, p.id]];
  if (p.role === "patient" || !p.staffName) return out;
  out.push([ROLE_STORAGE_KEY, p.role]);
  if (p.role === "nurse" || p.role === "doctor") out.push([CLINICIAN_ROLE_KEY, p.role]);
  out.push([reviewerStorageKey(p.role), p.staffName]);
  return out;
}

/** Applies personaStorage. Storage can be blocked (private mode): the case still opens, with the default identity. */
export function rememberPersona(p: DemoPersona, storage: Pick<Storage, "setItem"> | null): boolean {
  if (!storage) return false;
  try {
    for (const [k, v] of personaStorage(p)) storage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}

/**
 * After the launcher found the persona's case: a fresh case from POST /api/demo/start becomes the visitor's own
 * ("Your case B-xxx", "Open my demo case"); otherwise the key is removed, so no persona inherits another persona's
 * case (for example Pharmacist 1 being sent to a nurse-stage case stored by an earlier "Reset my demo case").
 */
export function rememberPersonaCase(
  p: DemoPersona,
  found: { id: string; code: string; fresh: boolean } | null,
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
): void {
  if (!storage) return;
  try {
    if (found?.fresh && needsCase(p)) storage.setItem(DEMO_CASE_KEY, JSON.stringify({ id: found.id, code: found.code, personaId: p.id }));
    else storage.removeItem(DEMO_CASE_KEY);
  } catch {
    /* storage blocked: the case still opens */
  }
}

/** Personas that work on one case. The patient starts a fresh intake on the phone; ops watches every case. */
export const needsCase = (p: DemoPersona) => p.role !== "patient" && p.role !== "ops";

/** Where a persona lands. Without a case id, staff land on their queue. */
export function personaHref(p: DemoPersona, caseId: string | null, lang: Lang = "en"): string {
  const id = caseId ? encodeURIComponent(caseId) : null;
  switch (p.role) {
    case "patient":
      return `${PATIENT_PATH}?new=1&lang=${lang}`;
    case "nurse":
      return id ? `/review/${id}` : "/review";
    case "doctor":
      return id ? `/review/${id}/consult?mode=doctor` : "/review";
    case "pharmacist":
      return id ? `/pharmacy/${id}` : "/pharmacy";
    case "ops":
      return "/ops";
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

/**
 * The persona's synthetic case: a fresh one from POST /api/demo/start at the persona's stage, else the shared
 * seeded one from GET /api/demo/cases (cap reached, rate limited, or demo starts disabled). null when neither works.
 */
export async function findPersonaCase(p: DemoPersona, fetchImpl: Fetch): Promise<{ id: string; code: string; fresh: boolean } | null> {
  if (!needsCase(p)) return null;
  try {
    const r = await fetchImpl("/api/demo/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: p.stage }),
    });
    if (r.ok) {
      const res = (await r.json()) as Partial<DemoStartRes>;
      if (typeof res.id === "string" && res.id) return { id: res.id, code: String(res.code ?? ""), fresh: true };
    }
  } catch {
    /* fall through to the shared case */
  }
  try {
    const r = await fetchImpl("/api/demo/cases", { cache: "no-store" });
    if (r.ok) {
      const cases = (await r.json()) as Partial<DemoCasesRes>;
      const c = cases[p.id as DemoPersonaId];
      if (c && typeof c.id === "string") return { id: c.id, code: c.code, fresh: false };
    }
  } catch {
    /* no case: the persona lands on their queue */
  }
  return null;
}
