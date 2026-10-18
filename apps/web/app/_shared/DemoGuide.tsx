"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { DemoPersona, DemoStartRes, Lang, SessionListItem, StaffRole } from "@medx/shared";
import { Icon, buttonClasses } from "@/components/ui";
import { onCaseChanged } from "./caseEvents";
import {
  DEMO_CASE_KEY, DEMO_PERSONA_KEY, applyDemoPersona, caseIdFromPath, demoHref, gt, nextStep, personaFor, readDemoCase, readDemoPersona, writeDemoCase,
  type DemoCase,
} from "./demoPersona";
import { useVisiblePolling } from "./visiblePolling";

/**
 * Demo guide bar (M-06). Renders only when a demo persona was chosen (localStorage "medx.demo.persona").
 * Says who the visitor is playing and the next step for the case's journey stage, links back to the persona picker,
 * and can start a fresh synthetic case at the persona's stage (POST /api/demo/start).
 * Neutral ocean styling on purpose: no Fin and no red, because it can sit above red-flag content.
 *
 * `rows`: the parent's polled GET /api/sessions rows (with `stage`). Leave it undefined and the guide fetches them
 * itself, slowly and only while the tab is visible. `role` and `userName`: the identity on screen, so the guide names
 * the person every write is attributed to.
 */
export function DemoGuide({ lang, role, userName, rows, onApply, className = "" }: {
  lang: Lang;
  role?: StaffRole;
  userName?: string;
  rows?: SessionListItem[] | null;
  onApply?: (p: DemoPersona) => void;
  className?: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [stored, setStored] = useState<DemoPersona | null>(null);
  const [demoCase, setDemoCase] = useState<DemoCase | null>(null);
  const [fetched, setFetched] = useState<SessionListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const read = () => { setStored(readDemoPersona()); setDemoCase(readDemoCase()); };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === DEMO_PERSONA_KEY || e.key === DEMO_CASE_KEY) read(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const pathCase = caseIdFromPath(path);
  const caseId = pathCase ?? demoCase?.id ?? null;
  const self = rows === undefined;
  const load = useCallback(() => {
    fetch("/api/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => { if (Array.isArray(d)) setFetched(d as SessionListItem[]); })
      .catch(() => { /* the guide falls back to the persona's starting stage */ });
  }, []);
  useVisiblePolling(load, 20000, caseId, !!stored && self && !!caseId);
  useEffect(() => (stored && self ? onCaseChanged(() => load()) : undefined), [stored, self, load]);

  if (!stored) return null;
  const persona = personaFor(role, userName, stored) ?? stored;
  const list = rows ?? fetched;
  const row = caseId ? list?.find((s) => s.id === caseId) : undefined;
  const stage = row?.stage ?? persona.stage;
  const who: StaffRole | "patient" = role ?? persona.role;
  const name = userName ?? persona.staffName ?? gt("patientName", lang);
  const step = nextStep(stage, who, {
    collecting: row?.status === "collecting",
    returned: (row?.orders?.medications ?? []).some((o) => o.status === "returned"),
  });

  async function reset() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/demo/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage: persona.stage }) });
      const body = (await res.json().catch(() => null)) as (Partial<DemoStartRes> & { error?: string }) | null;
      if (!res.ok || !body?.id) {
        setMsg(res.status === 429 ? gt("resetBusy", lang) : res.status === 404 ? gt("resetOff", lang) : gt("resetFailed", lang, { msg: body?.error ?? String(res.status) }));
        return;
      }
      const p = applyDemoPersona(persona.id) ?? persona;
      const c: DemoCase = { id: body.id, code: body.code ?? "", personaId: p.id };
      writeDemoCase(c);
      setDemoCase(c);
      setStored(p);
      onApply?.(p);
      router.push(demoHref(p, c.id));
    } catch (e) {
      setMsg(gt("resetFailed", lang, { msg: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={gt("label", lang)}
      data-demo-guide={persona.id}
      data-stage={stage}
      className={`cl-enter flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-ocean/20 bg-ocean-tint/70 px-4 py-3 shadow-hairline ${className}`}
    >
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-sheet text-ocean shadow-hairline">
        <Icon name="route" size={18} />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-micro font-semibold text-ocean">
          {gt("synthetic", lang)}
          {row?.code ? <> · {gt(demoCase?.id === row.id ? "caseCode" : "caseOther", lang, { code: row.code })}</> : null}
        </p>
        <p className="text-small text-ink">
          <span className="font-bold">{gt("you", lang, { name })}</span>
          <span aria-hidden="true" className="px-1.5 text-graphite">·</span>
          <span className="font-semibold">{gt("next", lang)}:</span> <span data-next-step>{step[lang]}</span>
        </p>
        {msg && <p role="status" className="mt-1 text-small font-semibold text-ink-soft">{msg}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Only the visitor's own case for this persona: never another persona's (a nurse-stage case for pharmacist 1). */}
        {!pathCase && demoCase && (!demoCase.personaId || demoCase.personaId === persona.id) && (
          <Link href={demoHref(persona, demoCase.id)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            {gt("openCase", lang)}
            <Icon name="arrow-right" size={14} />
          </Link>
        )}
        <Link href="/demo" className={buttonClasses({ variant: "quiet", size: "sm" })}>
          <Icon name="users" size={14} />
          {gt("switchPersona", lang)}
        </Link>
        <button type="button" onClick={reset} disabled={busy} aria-busy={busy} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <Icon name="rotate-ccw" size={14} />
          {busy ? gt("resetting", lang) : gt("reset", lang)}
        </button>
      </div>
    </section>
  );
}
