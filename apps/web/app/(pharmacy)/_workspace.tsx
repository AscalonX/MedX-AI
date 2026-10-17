"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AllergyEntry, AuditEvent, Lang, MedAlert, MedAlertReviewAction, MedicationEntry, MedReviewAction } from "@medx/shared";
import { Badge, Button, EvidenceHighlight, Field, InkConfidence, LangMorph, PencilField, type Mark } from "@/components/ui";
import {
  KIND_LABEL, L, LANG_NAME, PHARM_STATUS_LABEL, allergiesOf, alertsOf, auditLine, blockers, buildQuestions, clock, fetchSession, medsOf, openHigh,
  pharmStatus, selEvidence, selKey, waited, type Sel,
} from "./_lib";
import { usePharmacy } from "./_shell";

const T = {
  medicines: L("ยาที่ใช้", "Farmaci", "Medicines"),
  allergies: L("การแพ้", "Allergie", "Allergies"),
  alerts: L("การแจ้งเตือนด้านยา", "Avvisi sui farmaci", "Medication alerts"),
  questions: L("คำถามถึงผู้ป่วย", "Domande al paziente", "Questions for the patient"),
  dose: L("ขนาดยา", "Dose", "Dose"),
  frequency: L("ความถี่", "Frequenza", "Frequency"),
  timing: L("ช่วงเวลา", "Quando", "Timing"),
  notStated: L("ผู้ป่วยยังไม่ได้บอก", "Non ancora detto", "Not stated"),
  check: L("สิ่งที่ต้องตรวจ", "Da verificare", "Check"),
  nka: L("ไม่มีประวัติแพ้ยา", "Nessuna allergia nota", "No known allergies"),
  patientSaid: L("ผู้ป่วยพูดว่า", "Il paziente ha detto", "Patient said"),
};
const sm = "h-7! px-2! text-small!";
const cls = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");
const humanClass = (c: string | null) => (c ? c.replace(/_/g, " ") : null);

type Edit = { id: string; mode: "edit" | "identify" };
type Prev = Partial<Pick<MedicationEntry, "generic" | "dose" | "frequency">>;

export function Workspace({ id }: { id: string }) {
  const { entries, lang, reviewer, now, submit, fixtureAudit, error: queueError } = usePharmacy();
  const entry = entries?.find((e) => e.session.id === id);
  const session = entry?.session;
  const fixture = entry?.fixture ?? false;

  const [liveAudit, setLiveAudit] = useState<AuditEvent[]>([]);
  const [sel, setSel] = useState<Sel | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [prev, setPrev] = useState<Record<string, Prev>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSel(null); setEdit(null); setPrev({}); setActionError(null); setAuditOpen(false); }, [id]);

  // Real audit trail for live sessions. Fixtures keep theirs in the shell.
  useEffect(() => {
    if (!entry || fixture) return;
    let dead = false;
    const pull = () => fetchSession(id).then((d) => !dead && setLiveAudit(d.audit)).catch(() => {});
    pull();
    const t = setInterval(pull, 5000);
    return () => { dead = true; clearInterval(t); };
  }, [id, entry, fixture]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key !== "Escape" || tag === "INPUT" || tag === "TEXTAREA") return;
      setSel(null); setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setActionError(null);
    try { await fn(); return true; }
    catch (e) { setActionError(`${(e as Error).message}. Nothing was changed.`); return false; }
    finally { setBusy(false); }
  }, []);

  if (!entries) {
    return (
      <section aria-busy="true" aria-label="Loading reconciliation" className="flex flex-1 flex-col gap-4 bg-sheet p-6 shadow-sheet">
        {[0, 1, 2, 3].map((i) => <span key={i} className="mx-blank !block !h-5 !w-full" />)}
      </section>
    );
  }
  if (!session) {
    return (
      <section className="flex flex-1 flex-col gap-3 bg-sheet p-6 shadow-sheet">
        <h1 className="text-title">This intake has no medication data.</h1>
        <p className="text-body text-ink-soft">{queueError ? `The queue could not be refreshed: ${queueError}. ` : ""}It may have been removed, or the summary has not been produced yet.</p>
        <Link href="/pharmacy" className="text-body underline underline-offset-4">Back to the queue</Link>
      </section>
    );
  }

  const meds = medsOf(session);
  const allergies = allergiesOf(session);
  const alerts = alertsOf(session);
  const pl = session.patientLang;
  const st = pharmStatus(session);
  const locked = st === "reconciled";
  const block = blockers(session);
  const questions = buildQuestions(session);
  const allergyField = session.summary?.fields.find((f) => f.key === "allergies");
  const nka = allergies.length === 0 && allergyField?.status === "supported" && (allergyField.evidence.length ?? 0) > 0;
  const audit = fixture ? fixtureAudit[id] ?? [] : liveAudit;

  // Who touched which medicine / alert, from the audit log.
  const medBy = new Map<string, string>();
  for (const e of audit) {
    if (e.type !== "pharmacy_review") continue;
    for (const a of (e.payload.medActions as MedReviewAction[] | undefined) ?? []) medBy.set(a.medId, e.actorId ?? "pharmacist");
  }

  const send = (medActions: MedReviewAction[], alertActions: MedAlertReviewAction[] = [], complete?: boolean) =>
    run(() => submit(id, { medActions, alertActions, ...(complete ? { complete: true } : {}) }));

  // Highlighter: every quote in use is dotted, the selection is marked.
  const activeEv = selEvidence(session, sel);
  const used = [
    ...meds.flatMap((m) => m.evidence), ...allergies.flatMap((a) => a.evidence), ...alerts.flatMap((a) => a.evidence), ...(allergyField?.evidence ?? []),
  ];
  const marksFor = (turnId: string): Mark[] =>
    [...used, ...activeEv].filter((e) => e.turnId === turnId).map((e) => ({
      start: e.start, end: e.end, quote: e.quote, active: activeEv.some((a) => a.turnId === e.turnId && a.start === e.start && a.end === e.end),
    }));
  const announce = !sel ? "" : activeEv.length ? `Evidence, turn ${session.turns.findIndex((t) => t.id === activeEv[0].turnId) + 1}` : "No evidence quote for this item";

  const select = (s: Sel) => { setSel(s); setDrawer(true); };
  const selAlert = sel?.type === "alert" ? alerts.find((a) => a.id === sel.id) : undefined;
  const linkedToSel = (kind: "med" | "allergy", itemId: string) =>
    !!selAlert && (kind === "med" ? selAlert.medIds : selAlert.allergyIds).includes(itemId);
  const alertLinkedToSel = (a: MedAlert) => sel?.type === "med" && a.medIds.includes(sel.id) || sel?.type === "allergy" && a.allergyIds.includes(sel.id);

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(scrollRef.current?.parentElement?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  const extract = session.summary?.modelCalls.find((c) => c.step === "extract");

  return (
    <div onKeyDown={moveFocus} className="grid min-h-0 flex-1 grid-cols-1 gap-6 min-[1024px]:grid-cols-[minmax(0,1fr)_340px] min-[1280px]:grid-cols-[minmax(0,1fr)_340px_380px]">
      <p aria-live="polite" className="sr-only">{announce}</p>

      {/* ---------- the reconciliation sheet ---------- */}
      <section aria-label={`Medication reconciliation for ${session.code}`} className="flex min-h-0 min-w-0 flex-col bg-sheet shadow-sheet">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-6 pb-3 pt-5">
            <Link href="/pharmacy" className="text-small text-ink-soft underline underline-offset-4">Queue</Link>
            <h1 className="text-title">{session.code}</h1>
            <span lang={pl} className="text-body text-ink-soft">{LANG_NAME[pl]}</span>
            <span className="text-small text-ink-soft">
              started {clock(session.createdAt)}{!locked && now > 0 && <>, waiting {waited(session.createdAt, now)}</>}
            </span>
            <Badge tone={st === "reconciled" ? "ink" : st === "in_review" ? "outline" : "pencil"}>{PHARM_STATUS_LABEL[st]}</Badge>
            {fixture && <Badge tone="pencil">Fixture data</Badge>}
            <button type="button" onClick={() => setDrawer(true)} aria-controls="transcript" className="ml-auto text-small underline underline-offset-4 min-[1280px]:hidden">
              Patient&apos;s words
            </button>
          </header>
          {fixture && (
            <p role="note" className="mx-6 border-y border-rule py-2 text-small text-ink-soft">
              The engine does not return medication data yet. These are synthetic sessions that follow the contract, and your actions are kept in this browser only.
            </p>
          )}

          <section aria-labelledby="h-meds" className="border-t border-rule pt-3">
            <h2 id="h-meds" className="px-6 pb-1 font-sans text-small font-medium text-ink-soft"><LangMorph text={T.medicines} lang={lang} /></h2>
            {meds.length > 0 && (
              <p aria-hidden="true" className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 px-6 pb-1 text-micro text-ink-soft">
                <span>Patient&apos;s words ({LANG_NAME[pl]})</span><span>Generic name and class</span>
              </p>
            )}
            {meds.length === 0 ? (
              <p className="px-6 py-3 text-body text-ink-soft"><span className="mx-blank mr-2" aria-hidden="true" /><LangMorph text={L("ไม่พบยาที่ผู้ป่วยกล่าวถึง", "Nessun farmaco citato", "No medicines mentioned")} lang={lang} /></p>
            ) : (
              <ul>
                {meds.map((m) => (
                  <MedRow
                    key={m.id} m={m} lang={lang} pl={pl} busy={busy} locked={locked}
                    selected={sel?.type === "med" && sel.id === m.id} linked={linkedToSel("med", m.id)}
                    highAlert={alerts.some((a) => a.severity === "high" && !a.review && a.medIds.includes(m.id))}
                    by={medBy.get(m.id)} previous={prev[m.id]} editing={edit?.id === m.id ? edit.mode : null}
                    onSelect={() => select({ type: "med", id: m.id })}
                    onEdit={(mode) => setEdit({ id: m.id, mode })} onCancel={() => setEdit(null)}
                    onVerify={() => send([{ medId: m.id, action: "verify" }])}
                    onDiscontinue={() => send([{ medId: m.id, action: "discontinue" }])}
                    onSave={async (v) => {
                      const ok = await send([{ medId: m.id, action: "edit", ...v }]);
                      if (ok) { setEdit(null); setPrev((p) => ({ ...p, [m.id]: { generic: m.generic, dose: m.dose, frequency: m.frequency } })); }
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="h-alg" className="border-t border-rule pt-3">
            <h2 id="h-alg" className="px-6 pb-1 font-sans text-small font-medium text-ink-soft"><LangMorph text={T.allergies} lang={lang} /></h2>
            <ul>
              {allergies.map((a) => (
                <AllergyRow key={a.id} a={a} lang={lang} pl={pl} selected={sel?.type === "allergy" && sel.id === a.id} linked={linkedToSel("allergy", a.id)} onSelect={() => select({ type: "allergy", id: a.id })} />
              ))}
              {allergies.length === 0 && nka && allergyField && (
                <li className={sel?.type === "nka" ? "bg-paper" : ""}>
                  <button type="button" data-row aria-pressed={sel?.type === "nka"} aria-controls="transcript" onClick={() => select({ type: "nka", id: "nka" })} className="flex w-full flex-wrap items-baseline gap-x-3 px-6 py-2.5 text-left hover:bg-paper">
                    <span className="text-body font-medium"><LangMorph text={T.nka} lang={lang} /></span>
                    <span lang={pl} className="font-serif text-body italic text-ink-soft">&ldquo;{allergyField.evidence[0].quote}&rdquo;</span>
                  </button>
                </li>
              )}
              {allergies.length === 0 && !nka && (
                <li className="flex flex-wrap items-baseline gap-x-3 px-6 py-2.5">
                  <span className="mx-blank" aria-hidden="true" />
                  <span className="text-body text-ink-soft"><LangMorph text={L("ยังไม่ได้ระบุ ถามผู้ป่วย", "Non indicato, chiedere al paziente", "Not stated, ask the patient")} lang={lang} /></span>
                </li>
              )}
            </ul>
          </section>

          <section aria-labelledby="h-q" className="border-t border-rule pb-4 pt-3">
            <h2 id="h-q" className="px-6 pb-1 font-sans text-small font-medium text-ink-soft"><LangMorph text={T.questions} lang={lang} /></h2>
            {questions.length === 0 ? (
              <p className="px-6 py-2 text-small text-ink-soft"><LangMorph text={L("ไม่มีข้อมูลที่ต้องถามเพิ่ม", "Nessuna domanda in sospeso", "Nothing more to ask")} lang={lang} /></p>
            ) : (
              <ol className="flex flex-col">
                {questions.map((qn) => (
                  <li key={qn.id} className="flex flex-col gap-0.5 border-b border-rule px-6 py-2.5 last:border-b-0">
                    <p lang={pl} className="max-w-[65ch] font-serif text-lead text-ink">{qn.text[pl]}</p>
                    {lang !== pl && <p lang={lang} className="max-w-[70ch] text-small text-ink-soft"><LangMorph text={qn.text} lang={lang} /></p>}
                    <p className="text-micro text-graphite">{qn.why}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <SignOff
          busy={busy} locked={locked} block={block} error={actionError} audit={audit} open={auditOpen} onToggle={() => setAuditOpen((o) => !o)}
          reconciledBy={locked ? session.pharmacyReviewerId : undefined} reconciledAt={locked ? session.updatedAt : undefined}
          onSignOff={() => send([], [], true)} reviewer={reviewer}
          provenance={extract ? `Extracted by ${extract.provider} / ${extract.model}` : "Extraction record not available"}
          generatedAt={session.summary?.generatedAt}
        />
      </section>

      {/* ---------- alerts ---------- */}
      <aside aria-label="Medication alerts" className="flex min-h-0 min-w-0 flex-col bg-sheet shadow-sheet">
        <div className="flex items-baseline gap-3 border-b border-rule px-4 py-3">
          <h2 className="text-body"><LangMorph text={T.alerts} lang={lang} /></h2>
          {openHigh(session).length > 0 && <Badge tone="signalOutline">{openHigh(session).length} high to handle</Badge>}
        </div>
        {alerts.length === 0 ? (
          <p className="p-4 text-small text-ink-soft"><LangMorph text={L("ไม่พบการแจ้งเตือน กฎเป็นโค้ดตายตัว ไม่ใช่ผลของโมเดล", "Nessun avviso. Le regole sono codice deterministico, non il modello.", "No alerts. Rules are deterministic code, not the model.")} lang={lang} /></p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {[...alerts].sort((a, b) => Number(!!a.review) - Number(!!b.review) || Number(b.severity === "high") - Number(a.severity === "high")).map((a) => (
              <AlertItem
                key={a.id} a={a} lang={lang} meds={meds} busy={busy} locked={locked}
                selected={sel?.type === "alert" && sel.id === a.id} linked={!!alertLinkedToSel(a)}
                onSelect={() => select({ type: "alert", id: a.id })}
                onReview={(action, note) => send([], [{ alertId: a.id, action, ...(note ? { note } : {}) }])}
                onShowMed={(mid) => select({ type: "med", id: mid })}
              />
            ))}
          </ul>
        )}
      </aside>

      {/* ---------- transcript ---------- */}
      <aside
        id="transcript" aria-label="Patient's words"
        className={cls(
          "flex min-h-0 flex-col bg-sheet shadow-sheet",
          "max-[1279px]:fixed max-[1279px]:inset-y-0 max-[1279px]:right-0 max-[1279px]:z-20 max-[1279px]:w-[400px] max-[1279px]:max-w-full max-[1279px]:shadow-sheet-lifted",
          "max-[1279px]:transition-transform max-[1279px]:duration-base max-[1279px]:ease-pen",
          !drawer && "max-[1279px]:invisible max-[1279px]:translate-x-full",
        )}
      >
        <div className="flex items-center border-b border-rule px-4 py-3">
          <h2 className="text-body">Patient&apos;s words</h2>
          <button type="button" onClick={() => setDrawer(false)} className="ml-auto text-small underline underline-offset-4 min-[1280px]:hidden">Close</button>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto">
          {session.turns.map((t, i) => {
            const marks = marksFor(t.id);
            const hasActive = marks.some((m) => m.active);
            return (
              <li key={t.id} className="border-b border-rule px-4 py-3">
                <p className="flex gap-2 text-micro text-ink-soft">
                  <span>{i + 1}</span><span>{clock(t.at)}</span><span>{t.role === "patient" ? "Patient" : "Question"}</span><span lang={t.lang}>{LANG_NAME[t.lang]}</span>
                </p>
                {t.role === "patient" ? (
                  <EvidenceHighlight key={hasActive ? `${t.id}:${selKey(sel)}` : t.id} text={t.text} lang={t.lang} marks={marks} className="mt-1" />
                ) : (
                  <p lang={t.lang} className="mt-1 font-serif text-body text-ink-soft">{t.text}</p>
                )}
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}

// =====================================================================================
function MedRow({ m, lang, pl, busy, locked, selected, linked, highAlert, by, previous, editing, onSelect, onEdit, onCancel, onVerify, onDiscontinue, onSave }: {
  m: MedicationEntry; lang: Lang; pl: Lang; busy: boolean; locked: boolean; selected: boolean; linked: boolean; highAlert: boolean;
  by?: string; previous?: Prev; editing: "edit" | "identify" | null;
  onSelect: () => void; onEdit: (m: "edit" | "identify") => void; onCancel: () => void; onVerify: () => void; onDiscontinue: () => void;
  onSave: (v: { generic?: string; dose?: string; frequency?: string }) => void;
}) {
  const [draft, setDraft] = useState({ generic: "", dose: "", frequency: "" });
  const [confirmStop, setConfirmStop] = useState(false);
  useEffect(() => { if (!selected) setConfirmStop(false); }, [selected]);
  const stopped = m.status === "discontinued";
  const unmatched = m.status === "unmatched";
  const startEdit = (mode: "edit" | "identify") => { setDraft({ generic: m.generic ?? "", dose: m.dose ?? "", frequency: m.frequency ?? "" }); onEdit(mode); };
  const strike = (old: string | null | undefined, now: string | null) => (old && old !== now ? <s className="mx-struck mr-1.5 text-body">{old}</s> : null);

  const generic = (() => {
    if (unmatched) return <span className="inline-flex items-baseline gap-2"><span className="mx-blank" aria-hidden="true" /><span className="text-small text-ink-soft">Unmatched, identify</span></span>;
    if (m.status === "unsupported") return <PencilField value={m.generic ?? m.nameOriginal} lang={lang} />;
    if (stopped) return <span className="inline-flex flex-wrap items-baseline gap-x-2"><s className="mx-struck text-body">{m.generic ?? m.nameOriginal}</s><Badge tone="outline">Discontinued</Badge></span>;
    if (m.status === "edited") {
      return (
        <span className="inline-flex flex-wrap items-baseline gap-x-1">
          {strike(previous?.generic, m.generic)}
          <span className="text-body font-medium">{m.generic}</span>
          <span className="ml-1 text-micro text-ink-soft">Edited by pharmacist{by ? `, ${by}` : ""}</span>
        </span>
      );
    }
    if (m.status === "verified") return <span className="inline-flex flex-wrap items-baseline gap-2"><span className="text-body font-medium">{m.generic}</span><Badge tone="outline">Verified{by ? `, ${by}` : ""}</Badge></span>;
    return <InkConfidence confidence={m.confidence} lang={lang}><span className="text-body font-medium">{m.generic ?? m.nameOriginal}</span></InkConfidence>;
  })();

  const value = (v: string | null, was?: string | null) =>
    v ? <span lang={pl} className={cls("text-body", stopped && "mx-struck")}>{strike(was, v)}{v}</span> : <span className="mx-blank" aria-label="Not stated" />;

  return (
    <li className={cls("border-b border-rule last:border-b-0", (selected || linked) && "bg-paper")}>
      <button
        type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect}
        className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-x-4 px-6 pb-1 pt-2.5 text-left hover:bg-paper"
      >
        <span className="flex flex-col">
          <span lang={pl} className={cls("font-serif text-lead", stopped && "mx-struck")}>&ldquo;{m.nameOriginal}&rdquo;</span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 text-small text-ink-soft">
            {humanClass(m.drugClass) ?? "Class unknown"}
            {highAlert && <Badge tone="signalOutline">High alert</Badge>}
            {linked && <span className="text-micro">linked to selected alert</span>}
          </span>
          {generic}
        </span>
      </button>
      {editing ? (
        <form
          className="grid grid-cols-1 gap-3 px-6 pb-3 pt-1 min-[700px]:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (editing === "identify") { if (draft.generic.trim()) onSave({ generic: draft.generic.trim() }); return; }
            onSave({ generic: draft.generic.trim() || undefined, dose: draft.dose.trim() || undefined, frequency: draft.frequency.trim() || undefined });
          }}
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        >
          {editing === "identify" ? (
            <div className="min-[700px]:col-span-3">
              <Field autoFocus required maxLength={120} label="Identify as (generic name)" hint="Type the generic name from the box or label. The patient's words stay on record." value={draft.generic} onChange={(e) => setDraft({ ...draft, generic: e.target.value })} />
            </div>
          ) : (
            <>
              <Field autoFocus label="Generic name" maxLength={120} value={draft.generic} onChange={(e) => setDraft({ ...draft, generic: e.target.value })} />
              <Field label="Dose" maxLength={60} value={draft.dose} onChange={(e) => setDraft({ ...draft, dose: e.target.value })} />
              <Field label="Frequency" maxLength={60} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })} />
            </>
          )}
          <div className="flex items-center gap-2 min-[700px]:col-span-3">
            <Button type="submit" variant="primary" className={sm} disabled={busy || (editing === "identify" && !draft.generic.trim())}>Save</Button>
            <Button className={sm} onClick={onCancel}>Cancel</Button>
            <p className="text-micro text-ink-soft">The old value stays visible, struck through.</p>
          </div>
        </form>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-x-4 px-6 pb-2">
            {([["dose", m.dose, previous?.dose], ["frequency", m.frequency, previous?.frequency], ["timing", m.timing, undefined]] as const).map(([k, v, was]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-micro text-ink-soft"><LangMorph text={T[k]} lang={lang} /></dt>
                <dd>{value(v, m.status === "edited" ? was : undefined)}</dd>
              </div>
            ))}
          </dl>
          {!locked && (
            <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
              {unmatched ? (
                <Button className={sm} variant="primary" disabled={busy} onClick={() => startEdit("identify")}>Identify</Button>
              ) : (
                <>
                  <Button className={sm} disabled={busy || stopped || m.status === "verified"} onClick={onVerify}>Verify<span className="sr-only">, {m.nameOriginal}</span></Button>
                  <Button className={sm} disabled={busy || stopped} onClick={() => startEdit("edit")}>Edit<span className="sr-only">, {m.nameOriginal}</span></Button>
                </>
              )}
              {!stopped && !confirmStop && <Button className={sm} variant="quiet" disabled={busy} onClick={() => setConfirmStop(true)}>Discontinue<span className="sr-only">, {m.nameOriginal}</span></Button>}
              {confirmStop && (
                <>
                  <span className="text-small text-ink-soft">The patient does not take it now. It stays on the sheet, struck through.</span>
                  <Button className={sm} variant="primary" disabled={busy} onClick={() => { setConfirmStop(false); onDiscontinue(); }}>Confirm discontinue</Button>
                  <Button className={sm} onClick={() => setConfirmStop(false)}>Cancel</Button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function AllergyRow({ a, lang, pl, selected, linked, onSelect }: { a: AllergyEntry; lang: Lang; pl: Lang; selected: boolean; linked: boolean; onSelect: () => void }) {
  return (
    <li className={cls("border-b border-rule last:border-b-0", (selected || linked) && "bg-paper")}>
      <button type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect} className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-x-4 px-6 py-2.5 text-left hover:bg-paper">
        <span lang={pl} className="font-serif text-lead">&ldquo;{a.allergenOriginal}&rdquo;</span>
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-2">
            {a.status === "unsupported" ? <PencilField value={a.allergenClass ?? a.allergenOriginal} lang={lang} /> :
              a.status === "unmatched" ? <><span className="mx-blank" aria-hidden="true" /><span className="text-small text-ink-soft">Unmatched, ask which medicine</span></> :
                <span className="text-body font-medium">{a.allergenClass ?? a.allergenOriginal}</span>}
            {a.status === "verified" && <Badge tone="outline">Verified</Badge>}
            {linked && <span className="text-micro text-ink-soft">linked to selected alert</span>}
          </span>
          <span className="text-small text-ink-soft">
            <LangMorph text={L("อาการแพ้", "Reazione", "Reaction")} lang={lang} />:{" "}
            {a.reaction ? <span lang={pl} className="text-ink">{a.reaction}</span> : <span className="mx-blank" aria-label="Not stated" />}
          </span>
        </span>
      </button>
    </li>
  );
}

function AlertItem({ a, lang, meds, busy, locked, selected, linked, onSelect, onReview, onShowMed }: {
  a: MedAlert; lang: Lang; meds: MedicationEntry[]; busy: boolean; locked: boolean; selected: boolean; linked: boolean;
  onSelect: () => void; onReview: (action: MedAlertReviewAction["action"], note?: string) => void; onShowMed: (id: string) => void;
}) {
  const [form, setForm] = useState<null | "resolved" | "false_alarm">(null);
  const [note, setNote] = useState("");
  const open = !a.review;
  const urgent = a.severity === "high" && open;
  const linkedMeds = a.medIds.map((id) => meds.find((m) => m.id === id)).filter(Boolean) as MedicationEntry[];
  const verb = { acknowledge: "Acknowledged", resolved: "Resolved", false_alarm: "Marked false alarm" } as const;
  return (
    <li className={cls("flex flex-col gap-2 border-b border-rule px-4 py-3", urgent && "border-t-2 border-t-signal bg-signal-tint", !urgent && (selected || linked) && "bg-paper")}>
      <button type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect} className={cls("flex flex-wrap items-center gap-x-2 gap-y-1 text-left", selected && "underline underline-offset-4")}>
        <Badge tone={a.severity === "high" ? (open ? "signalOutline" : "outline") : "outline"}>{a.severity === "high" ? "High" : "Moderate"}</Badge>
        <span className="text-body font-medium"><LangMorph text={KIND_LABEL[a.kind]} lang={lang} /></span>
        <span className="text-micro text-ink-soft">{a.ruleId}<span className="sr-only">, show in the patient&apos;s words</span></span>
      </button>
      <p className="text-body"><LangMorph text={a.message} lang={lang} /></p>
      <p className="text-small text-ink-soft"><span className="font-medium"><LangMorph text={T.check} lang={lang} />: </span><LangMorph text={a.action} lang={lang} /></p>
      {linkedMeds.length > 0 && (
        <p className="flex flex-wrap gap-x-3 text-small">
          {linkedMeds.map((m) => (
            <button key={m.id} type="button" onClick={() => onShowMed(m.id)} className="underline underline-offset-4">{m.nameOriginal}</button>
          ))}
        </p>
      )}
      <p className="text-micro text-graphite">{a.source}</p>
      {a.review ? (
        <p className="text-small text-ink-soft">
          {verb[a.review.action]} by {a.review.reviewerId}, {clock(a.review.at)}.{a.review.note ? ` Note: ${a.review.note}` : ""} The alert stays on the record.
        </p>
      ) : !locked && !form ? (
        <div className="flex flex-wrap gap-2">
          <Button className={sm} disabled={busy} onClick={() => onReview("acknowledge")}>Acknowledge</Button>
          <Button className={sm} disabled={busy} onClick={() => { setForm("resolved"); setNote(""); }}>Resolved</Button>
          <Button className={sm} disabled={busy} onClick={() => { setForm("false_alarm"); setNote(""); }}>False alarm</Button>
        </div>
      ) : null}
      {form && open && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => { e.preventDefault(); if (form === "resolved" || note.trim()) { onReview(form, note.trim() || undefined); setForm(null); } }}
          onKeyDown={(e) => { if (e.key === "Escape") setForm(null); }}
        >
          <Field
            autoFocus required={form === "false_alarm"} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
            label={form === "false_alarm" ? "Why is this a false alarm?" : "What was done? (optional)"} hint="The alert stays on the record."
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className={sm} disabled={busy || (form === "false_alarm" && !note.trim())}>{form === "resolved" ? "Record resolved" : "Record false alarm"}</Button>
            <Button className={sm} onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </li>
  );
}

function SignOff({ busy, locked, block, error, audit, open, onToggle, onSignOff, reconciledBy, reconciledAt, reviewer, provenance, generatedAt }: {
  busy: boolean; locked: boolean; block: string[]; error: string | null; audit: AuditEvent[]; open: boolean; onToggle: () => void; onSignOff: () => void;
  reconciledBy?: string; reconciledAt?: string; reviewer: string; provenance: string; generatedAt?: string;
}) {
  return (
    <footer className="shrink-0 border-t border-rule">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        {!locked && (
          <Button variant="primary" disabled={busy || block.length > 0} aria-describedby="signoff-block" onClick={onSignOff}>Sign off reconciliation</Button>
        )}
        <div className="min-w-0 flex-1 basis-64">
          {error && <p role="alert" className="text-small text-signal">{error}</p>}
          {locked ? (
            <p className="text-small text-ink-soft">
              <Badge tone="ink">Reconciled</Badge> <span className="ml-1">Signed off by {reconciledBy ?? "pharmacist"}{reconciledAt ? `, ${clock(reconciledAt)}` : ""}. The sheet is read only.</span>
            </p>
          ) : block.length > 0 ? (
            <p id="signoff-block" role="status" className="text-small text-ink-soft">
              <span className="font-medium text-ink">Blocked: </span>{block.join("; ")}.
            </p>
          ) : (
            <p id="signoff-block" className="text-small text-ink-soft">Every high alert is handled and no medicine is unmatched. Signing off as {reviewer}.</p>
          )}
        </div>
      </div>
      <div className="border-t border-rule px-6 py-2">
        <button type="button" aria-expanded={open} aria-controls="audit-log" onClick={onToggle} className="text-small text-ink-soft underline underline-offset-4">
          {open ? "Hide" : "Show"} audit and provenance ({audit.length} events)
        </button>
        <p className="mt-0.5 text-micro text-graphite">{provenance}{generatedAt ? `, summary ${clock(generatedAt)}` : ""}.</p>
        {open && (
          <ol id="audit-log" className="mt-2 max-h-40 overflow-y-auto border-t border-rule">
            <li className="border-b border-rule py-1.5 text-micro text-graphite">Alerts come from deterministic rules; a model cannot clear them. Nothing here changes care until a clinician confirms.</li>
            {audit.length === 0 && <li className="py-1.5 text-small text-ink-soft">No pharmacist actions recorded yet.</li>}
            {audit.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-rule py-1.5 text-small last:border-b-0">
                <span className="w-14 shrink-0 text-ink-soft">{clock(e.at)}</span>
                <span>{auditLine(e)}{e.actorId ? <span className="text-ink-soft">, {e.actorId}</span> : null}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </footer>
  );
}

