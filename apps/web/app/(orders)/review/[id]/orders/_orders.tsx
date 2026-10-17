"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConsultState, ConsultSuggestion, GetSessionRes, IntakeSession, InvestigationOrderReq, Localized } from "@medx/shared";
import { Button, Card, CardHeader, Field, Icon, Pill } from "@/components/ui";
import { useFrame } from "../../../../(clinician)/_frame";
import { Head, Notice } from "../../../_bits";
import { CATALOG, fixtureConsider, fixtureInvestigation, fixtureSession } from "../../../_fixture";
import { asSession, call, clockOf, tr, type TKey } from "../../../_lib";
import { Meds } from "./_meds";
import { statusBadge } from "../../../_bits";

type Cat = "lab" | "imaging" | "ecg" | "other";
const CATS: { v: "all" | Cat; k: TKey }[] = [{ v: "all", k: "all" }, { v: "lab", k: "lab" }, { v: "imaging", k: "imaging" }, { v: "ecg", k: "ecg" }, { v: "other", k: "other" }];
interface Pick { code: string; label: Localized; category: Cat; fromSuggestionId?: string }

export function Orders({ id }: { id: string }) {
  const { lang, reviewer } = useFrame();
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [fixture, setFixture] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [consider, setConsider] = useState<ConsultSuggestion[]>([]);
  const fixtureRef = useRef(false);
  fixtureRef.current = fixture;

  const load = useCallback(async () => {
    try {
      const r = await call<GetSessionRes>(`/api/sessions/${id}`, undefined, () => ({ session: fixtureSession(id), audit: [] }));
      setSession((cur) => (fixtureRef.current && cur ? cur : r.data.session));
      setFixture((f) => f || r.fixture);
      const c = await call<ConsultState>(`/api/sessions/${id}/consult?mode=doctor`, undefined, () => ({ sessionId: id, mode: "doctor", suggestions: fixtureConsider, note: null, modelCalls: [] }));
      setConsider(c.data.suggestions.filter((s) => s.kind === "consider"));
      if (c.fixture) setFixture(true);
      setLoadErr(null);
    } catch (e) { setLoadErr((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const apply = (s: IntakeSession, fx: boolean) => { setSession(s); if (fx) setFixture(true); };
  return (
    <div className="cl-enter mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Head id={id} title={tr("ordersTitle", lang)} session={session} lang={lang} fixture={fixture} />
      {loadErr && <Notice>{tr("loadFail", lang)} {loadErr}</Notice>}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Investigations id={id} session={session} consider={consider} lang={lang} reviewer={reviewer} apply={apply} />
        <Meds id={id} session={session} lang={lang} reviewer={reviewer} apply={apply} />
      </div>
      <p className="mt-4 text-small text-ink-soft">{tr("prototype", lang)}</p>
    </div>
  );
}

function Investigations({ id, session, consider, lang, reviewer, apply }: {
  id: string; session: IntakeSession | null; consider: ConsultSuggestion[]; lang: "en" | "th" | "it"; reviewer: string; apply: (s: IntakeSession, fx: boolean) => void;
}) {
  const [cat, setCat] = useState<"all" | Cat>("all");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ordered = session?.orders?.investigations ?? [];
  const active = new Set(ordered.filter((o) => o.status !== "cancelled").map((o) => o.code));
  const items = CATALOG.items.filter((i) => (cat === "all" || i.category === cat) && i.label[lang].toLowerCase().includes(q.trim().toLowerCase()));
  const catOf = (code: string): Cat => CATALOG.items.find((i) => i.id === code)?.category ?? "other";

  async function place() {
    if (!pick || !session) return;
    const req: InvestigationOrderReq = { orderedBy: reviewer, code: pick.code, reason: reason.trim() || undefined, fromSuggestionId: pick.fromSuggestionId };
    setBusy(true); setErr(null);
    try {
      const r = await call<unknown>(`/api/sessions/${id}/orders/investigations`, req, () => fixtureInvestigation(session, reviewer, pick.code, pick.label, pick.category, req.reason, req.fromSuggestionId));
      apply(asSession(r.data), r.fixture);
      setPick(null); setReason("");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const withGuideline = consider.filter((c) => c.guideline && /^https:\/\//.test(c.guideline.url));
  const chips = consider.flatMap((c) => (c.workup ?? []).map((w) => ({ c, w })));
  return (
    <Card>
      <CardHeader title={tr("invTitle", lang)} />

      {consider.length > 0 && (
        <section className="mb-5 rounded-2xl bg-paper p-4" aria-label={tr("suggestedByConsult", lang)}>
          <h3 className="text-small font-bold text-ink">{tr("suggestedByConsult", lang)} <span className="font-normal text-ink-soft">({tr("consideredNotOrdered", lang)})</span></h3>
          <p className="text-micro text-ink-soft">{tr("forReview", lang)}</p>
          {chips.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {chips.map(({ c, w }) => (
                <li key={`${c.id}-${w.id}`}>
                  <button
                    type="button" disabled={active.has(w.id)}
                    onClick={() => setPick({ code: w.id, label: w.label, category: catOf(w.id), fromSuggestionId: c.id })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-ocean/60 bg-ocean-tint px-3.5 text-small font-semibold text-ocean hover:bg-sheet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean disabled:border-rule disabled:bg-muted disabled:text-graphite"
                  >
                    {w.label[lang]} <span className="text-micro font-normal">{active.has(w.id) ? tr("ordered", lang) : tr("consideredNotOrdered", lang)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {withGuideline.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {withGuideline.map((c) => (
                <li key={c.id} className="text-small text-ink">
                  <span className="text-ink-soft">{c.text[lang]}</span>{" "}
                  <a href={c.guideline!.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ocean underline-offset-2 hover:underline">
                    {tr("readGuideline", lang)}: {c.guideline!.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1"><Field label={tr("invSearch", lang)} type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={tr("invTitle", lang)}>
        {CATS.map((c) => <Pill key={c.v} active={cat === c.v} onClick={() => setCat(c.v)}>{tr(c.k, lang)}</Pill>)}
      </div>
      <ul className="mt-3 grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" tabIndex={0} aria-label={tr("invTitle", lang)}>
        {items.map((i) => (
          <li key={i.id}>
            <button
              type="button" disabled={active.has(i.id)} onClick={() => setPick({ code: i.id, label: i.label, category: i.category })}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-control border border-rule-strong/50 bg-sheet px-3.5 py-2 text-left text-body font-semibold text-ink hover:border-ocean focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean disabled:bg-muted disabled:text-graphite"
            >
              {i.label[lang]}
              <span className="text-micro font-normal text-ink-soft">{active.has(i.id) ? tr("ordered", lang) : tr(i.category, lang)}</span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-body text-ink-soft">{tr("noMatch", lang)}</li>}
      </ul>

      {pick && (
        <div className="mt-4 space-y-3 rounded-2xl border border-ocean/30 bg-ocean-tint/40 p-4">
          <Field label={`${tr("reason", lang)} · ${pick.label[lang]}`} autoFocus value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void place(); } if (e.key === "Escape") setPick(null); }} />
          {err && <Notice>{err}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} icon={<Icon name="check" size={16} />} onClick={place}>{tr("placeOrder", lang, { what: pick.label[lang] })}</Button>
            <Button onClick={() => { setPick(null); setErr(null); }}>{tr("cancelPick", lang)}</Button>
          </div>
        </div>
      )}

      <h3 className="mt-6 text-small font-bold text-ink">{tr("ordered", lang)}</h3>
      {ordered.length === 0 ? (
        <p className="mt-1 text-body text-ink-soft">{tr("noneOrdered", lang)}</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule rounded-2xl bg-paper px-4">
          {ordered.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="text-body font-semibold text-ink">{o.label[lang]}</span>
              {statusBadge(o.status, lang)}
              <span className="ml-auto text-small text-ink-soft">{o.orderedBy}, {clockOf(o.at, lang)}</span>
              {o.reason && <span className="basis-full text-small text-ink-soft">{o.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
