"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AllergyEntry, AllergyReviewAction, AuditEvent, Lang, MedAlert, MedAlertReviewAction, MedicationEntry, MedReviewAction } from "@medx/shared";
import { Badge, Button, EvidenceHighlight, Field, InkConfidence, LangMorph, PencilField, type Mark } from "@/components/ui";
import {
  KIND_LABEL, L, LANG_NAME, PHARM_STATUS_LABEL, U, allergiesOf, alertsOf, auditLine, blockers, buildQuestions, clock, fetchSession, hasNka, isAbstained,
  medsOf, openHigh, pharmStatus, redFlagsOf, selEvidence, selKey, waited, type Sel,
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
  check: L("สิ่งที่ต้องตรวจ", "Da verificare", "Check"),
  reaction: L("อาการแพ้", "Reazione", "Reaction"),
};
const sm = "h-7! px-2! text-small!";
const cls = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");
const humanClass = (c: string | null) => (c ? c.replace(/_/g, " ") : null);
const M = (l: Lang, k: keyof typeof U) => U[k][l];

type Edit = { id: string; mode: "edit" | "identify" };

export function Workspace({ id }: { id: string }) {
  const { entries, lang, reviewer, now, submit, fixtureAudit, error: queueError } = usePharmacy();
  const entry = entries?.find((e) => e.session.id === id);
  const session = entry?.session;
  const fixture = entry?.fixture ?? false;

  const [liveAudit, setLiveAudit] = useState<AuditEvent[]>([]);
  const [sel, setSel] = useState<Sel | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSel(null); setEdit(null); setActionError(null); setAuditOpen(false); }, [id]);

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
    catch (e) { setActionError(`${(e as Error).message}`); return false; }
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

  const abstained = isAbstained(session);
  // An abstained summary carries no clinical conclusions: nothing below may render from it.
  const meds = abstained ? [] : medsOf(session);
  const allergies = abstained ? [] : allergiesOf(session);
  const alerts = abstained ? [] : alertsOf(session);
  const flags = redFlagsOf(session);
  const pl = session.patientLang;
  const st = pharmStatus(session);
  const locked = st === "reconciled";
  const block = blockers(session);
  const questions = buildQuestions(session);
  const nka = !abstained && allergies.length === 0 && hasNka(session);
  const nkaEv = abstained ? [] : session.summary?.noKnownAllergiesEvidence ?? [];
  const audit = fixture ? fixtureAudit[id] ?? [] : liveAudit;

  const medBy = new Map<string, string>();
  for (const e of audit) {
    if (e.type !== "pharmacy_review") continue;
    for (const a of (e.payload.medActions as MedReviewAction[] | undefined) ?? []) medBy.set(a.medId, e.actorId ?? "pharmacist");
  }

  const send = (medActions: MedReviewAction[], alertActions: MedAlertReviewAction[] = [], complete?: boolean, allergyActions?: AllergyReviewAction[]) =>
    run(() => submit(id, { medActions, alertActions, ...(allergyActions ? { allergyActions } : {}), ...(complete ? { complete: true } : {}) }));

  const activeEv = selEvidence(session, sel);
  const used = [...meds.flatMap((m) => m.evidence), ...allergies.flatMap((a) => a.evidence), ...alerts.flatMap((a) => a.evidence), ...nkaEv];
  const marksFor = (turnId: string): Mark[] =>
    [...used, ...activeEv].filter((e) => e.turnId === turnId).map((e) => ({
      start: e.start, end: e.end, quote: e.quote, active: activeEv.some((a) => a.turnId === e.turnId && a.start === e.start && a.end === e.end),
    }));
  const announce = !sel ? "" : activeEv.length ? `Evidence, turn ${session.turns.findIndex((t) => t.id === activeEv[0].turnId) + 1}` : "No evidence quote for this item";

  const select = (s: Sel) => { setSel(s); setDrawer(true); };
  const selAlert = sel?.type === "alert" ? alerts.find((a) => a.id === sel.id) : undefined;
  const linkedToSel = (kind: "med" | "allergy", itemId: string) => !!selAlert && (kind === "med" ? selAlert.medIds : selAlert.allergyIds).includes(itemId);
  const alertLinkedToSel = (a: MedAlert) => (sel?.type === "med" && a.medIds.includes(sel.id)) || (sel?.type === "allergy" && a.allergyIds.includes(sel.id));

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(scrollRef.current?.parentElement?.parentElement?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  const extract = session.summary?.modelCalls.find((c) => c.step === "extract");

  return (
    <div onKeyDown={moveFocus} className="grid min-h-0 flex-1 grid-cols-1 gap-6 min-[1024px]:grid-cols-[minmax(0,1fr)_340px] min-[1280px]:grid-cols-[minmax(0,1fr)_340px_380px]">
      <p aria-live="polite" className="sr-only">{announce}</p>

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

          {flags.length > 0 && (
            <section aria-labelledby="h-flags" role="alert" className="mx-6 mb-3 border-y-2 border-signal bg-signal-tint">
              <h2 id="h-flags" className="px-3 pt-2 font-sans text-small font-medium"><LangMorph text={U.flags} lang={lang} /></h2>
              <ul>
                {flags.map((h) => (
                  <li key={h.ruleId} className="flex flex-col gap-1 border-b border-rule px-3 py-2 last:border-b-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge tone={h.severity === "emergency" ? "signal" : "signalOutline"}>{h.severity === "emergency" ? "Emergency" : "Urgent"}</Badge>
                      <span className="font-serif text-lead"><LangMorph text={h.label} lang={lang} /></span>
                      <span className="text-micro text-ink-soft">{h.ruleId}</span>
                    </p>
                    <p className="text-small"><LangMorph text={h.action} lang={lang} /></p>
                    <p className="text-small text-ink-soft">
                      {h.review ? <>{M(lang, "flagDone")} {h.review.reviewerId}, {clock(h.review.at)}</> : <LangMorph text={U.flagOpen} lang={lang} />}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="px-3 pb-2 pt-1 text-small">
                <Link href={`/review/${session.id}`} className="font-medium underline underline-offset-4"><LangMorph text={U.flagReview} lang={lang} /></Link>
              </p>
            </section>
          )}
          {fixture && <p role="note" className="mx-6 border-y border-rule py-2 text-small text-ink-soft"><LangMorph text={U.fixtureNote} lang={lang} /></p>}

          {abstained ? (
            <section aria-labelledby="h-abst" className="flex flex-col gap-2 border-t border-rule px-6 py-5">
              <h2 id="h-abst" className="text-title"><LangMorph text={U.needsHuman} lang={lang} /></h2>
              <p className="max-w-[60ch] text-body text-ink-soft"><LangMorph text={U.needsHumanBody} lang={lang} /></p>
              {session.summary?.abstainReason && <p className="text-micro text-graphite">{session.summary.abstainReason}</p>}
              <button type="button" onClick={() => setDrawer(true)} aria-controls="transcript" className="self-start text-small underline underline-offset-4">Patient&apos;s words</button>
            </section>
          ) : (
            <>
              <section aria-labelledby="h-meds" className="border-t border-rule pt-3">
                <h2 id="h-meds" className="px-6 pb-1 font-sans text-small font-medium text-ink-soft"><LangMorph text={T.medicines} lang={lang} /></h2>
                {meds.length > 0 && (
                  <p aria-hidden="true" className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 px-6 pb-1 text-micro text-ink-soft">
                    <span>Patient&apos;s words ({LANG_NAME[pl]})</span><span>Generic name and class</span>
                  </p>
                )}
                {meds.length === 0 ? (
                  <p className="px-6 py-3 text-body text-ink-soft"><span className="mx-blank mr-2" aria-hidden="true" /><LangMorph text={U.noMeds} lang={lang} /></p>
                ) : (
                  <ul>
                    {meds.map((m) => (
                      <MedRow
                        key={m.id} m={m} lang={lang} pl={pl} busy={busy} locked={locked}
                        selected={sel?.type === "med" && sel.id === m.id} linked={linkedToSel("med", m.id)}
                        highAlert={alerts.some((a) => a.severity === "high" && !a.review && a.medIds.includes(m.id))}
                        by={m.review?.reviewerId ?? medBy.get(m.id)} editing={edit?.id === m.id ? edit.mode : null}
                        onSelect={() => select({ type: "med", id: m.id })}
                        onEdit={(mode) => setEdit({ id: m.id, mode })} onCancel={() => setEdit(null)}
                        onVerify={() => send([{ medId: m.id, action: "verify" }])}
                        onDiscontinue={() => send([{ medId: m.id, action: "discontinue" }])}
                        onSave={async (v) => { if (await send([{ medId: m.id, action: "edit", ...v }])) setEdit(null); }}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="h-alg" className="border-t border-rule pt-3">
                <h2 id="h-alg" className="px-6 pb-1 font-sans text-small font-medium text-ink-soft"><LangMorph text={T.allergies} lang={lang} /></h2>
                <ul>
                  {allergies.map((a) => (
                    <AllergyRow
                      key={a.id} a={a} lang={lang} pl={pl} busy={busy} locked={locked}
                      selected={sel?.type === "allergy" && sel.id === a.id} linked={linkedToSel("allergy", a.id)}
                      editing={edit?.id === a.id}
                      onSelect={() => select({ type: "allergy", id: a.id })} onEdit={() => setEdit({ id: a.id, mode: "edit" })} onCancel={() => setEdit(null)}
                      onVerify={() => send([], [], false, [{ allergyId: a.id, action: "verify" }])}
                      onSave={async (v) => { if (await send([], [], false, [{ allergyId: a.id, action: "edit", ...v }])) setEdit(null); }}
                    />
                  ))}
                  {nka && (
                    <li className={sel?.type === "nka" ? "bg-paper" : ""}>
                      <button type="button" data-row aria-pressed={sel?.type === "nka"} aria-controls="transcript" onClick={() => select({ type: "nka", id: "nka" })} className="flex w-full flex-wrap items-baseline gap-x-3 px-6 py-2.5 text-left hover:bg-paper">
                        <span className="text-body font-medium"><LangMorph text={U.nka} lang={lang} /></span>
                        <span lang={pl} className="font-serif text-body italic text-ink-soft">&ldquo;{nkaEv[0].quote}&rdquo;</span>
                      </button>
                    </li>
                  )}
                  {allergies.length === 0 && !nka && (
                    <li className="flex flex-wrap items-baseline gap-x-3 px-6 py-2.5">
                      <span className="mx-blank" aria-hidden="true" />
                      <span className="text-body text-ink-soft"><LangMorph text={U.notStatedAsk} lang={lang} /></span>
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
            </>
          )}
        </div>

        <SignOff
          lang={lang} busy={busy} locked={locked} block={block} error={actionError} audit={audit} open={auditOpen} onToggle={() => setAuditOpen((o) => !o)}
          reconciledBy={locked ? session.pharmacyReviewerId : undefined} reconciledAt={locked ? session.updatedAt : undefined}
          onSignOff={() => send([], [], true)} reviewer={reviewer}
          provenance={extract ? `Extracted by ${extract.provider} / ${extract.model}` : "Extraction record not available"}
          generatedAt={session.summary?.generatedAt}
        />
      </section>

      <aside aria-label="Medication alerts" className="flex min-h-0 min-w-0 flex-col bg-sheet shadow-sheet">
        <div className="flex items-baseline gap-3 border-b border-rule px-4 py-3">
          <h2 className="text-body"><LangMorph text={T.alerts} lang={lang} /></h2>
          {!abstained && openHigh(session).length > 0 && <Badge tone="signalOutline">{openHigh(session).length} high to handle</Badge>}
        </div>
        {abstained ? (
          <p className="p-4 text-small text-ink-soft"><LangMorph text={U.needsHuman} lang={lang} />. <LangMorph text={L("ไม่แสดงการแจ้งเตือนเมื่อไม่มีสรุป", "Nessun avviso mostrato senza riepilogo", "No alerts are shown without a summary")} lang={lang} /></p>
        ) : alerts.length === 0 ? (
          <p className="p-4 text-small text-ink-soft"><LangMorph text={U.noAlerts} lang={lang} /></p>
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
function MedRow({ m, lang, pl, busy, locked, selected, linked, highAlert, by, editing, onSelect, onEdit, onCancel, onVerify, onDiscontinue, onSave }: {
  m: MedicationEntry; lang: Lang; pl: Lang; busy: boolean; locked: boolean; selected: boolean; linked: boolean; highAlert: boolean;
  by?: string; editing: "edit" | "identify" | null;
  onSelect: () => void; onEdit: (m: "edit" | "identify") => void; onCancel: () => void; onVerify: () => void; onDiscontinue: () => void;
  onSave: (v: { generic?: string; dose?: string; frequency?: string }) => void;
}) {
  const [draft, setDraft] = useState({ generic: "", dose: "", frequency: "" });
  const [confirmStop, setConfirmStop] = useState(false);
  useEffect(() => { if (!selected) setConfirmStop(false); }, [selected]);
  const stopped = m.status === "discontinued";
  const unmatched = m.status === "unmatched";
  const pencil = m.status === "unsupported"; // the whole entry is unverified, not only the generic name
  const prev = m.review?.previous;
  const startEdit = (mode: "edit" | "identify") => { setDraft({ generic: m.generic ?? "", dose: m.dose ?? "", frequency: m.frequency ?? "" }); onEdit(mode); };
  const strike = (old: string | null | undefined, now: string | null) => (old && old !== now ? <s className="mx-struck mr-1.5 text-body">{old}</s> : null);

  const generic = (() => {
    if (unmatched) return <span className="inline-flex items-baseline gap-2"><span className="mx-blank" aria-hidden="true" /><span className="text-small text-ink-soft">{M(lang, "unmatched")}</span></span>;
    if (pencil) return <PencilField value={m.generic ?? m.nameOriginal} lang={lang} />;
    if (stopped) return <span className="inline-flex flex-wrap items-baseline gap-x-2"><s className="mx-struck text-body">{m.generic ?? m.nameOriginal}</s><Badge tone="outline">{M(lang, "stopped")}</Badge></span>;
    if (m.status === "edited") {
      return (
        <span className="inline-flex flex-wrap items-baseline gap-x-1">
          {strike(prev?.generic, m.generic)}
          <span className="text-body font-medium">{m.generic ?? m.nameOriginal}</span>
          <span className="ml-1 text-micro text-ink-soft">{M(lang, "editedBy")}{by ? `, ${by}` : ""}</span>
        </span>
      );
    }
    if (m.status === "verified") return <span className="inline-flex flex-wrap items-baseline gap-2"><span className="text-body font-medium">{m.generic ?? m.nameOriginal}</span><Badge tone="outline">{M(lang, "verified")}{by ? `, ${by}` : ""}</Badge></span>;
    return <InkConfidence confidence={m.confidence} lang={lang}><span className="text-body font-medium">{m.generic ?? m.nameOriginal}</span></InkConfidence>;
  })();

  const value = (v: string | null, was?: string | null) => {
    const struck = m.status === "edited" ? strike(was, v) : null;
    if (!v) return <>{struck}{<span className="mx-blank" aria-label="Not stated" />}</>;
    return <span lang={pl} className={cls("text-body", stopped && "mx-struck", pencil && "mx-pencil")}>{struck}{v}</span>;
  };

  return (
    <li className={cls("border-b border-rule last:border-b-0", (selected || linked) && "bg-paper")}>
      <button
        type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect}
        className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-x-4 px-6 pb-1 pt-2.5 text-left hover:bg-paper"
      >
        <span lang={pl} className={cls("font-serif text-lead", stopped && "mx-struck", pencil && "mx-pencil")}>&ldquo;{m.nameOriginal}&rdquo;</span>
        <span className="flex flex-col gap-0.5">
          <span className={cls("flex flex-wrap items-center gap-x-2 text-small", pencil ? "text-graphite" : "text-ink-soft")}>
            {humanClass(m.drugClass) ?? M(lang, "classUnknown")}
            {highAlert && <Badge tone="signalOutline">{M(lang, "highAlert")}</Badge>}
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
            // Only changed fields are sent. An empty string means "clear this value".
            const v: { generic?: string; dose?: string; frequency?: string } = {};
            if (draft.generic.trim() && draft.generic.trim() !== (m.generic ?? "")) v.generic = draft.generic.trim();
            if (draft.dose.trim() !== (m.dose ?? "")) v.dose = draft.dose.trim();
            if (draft.frequency.trim() !== (m.frequency ?? "")) v.frequency = draft.frequency.trim();
            if (Object.keys(v).length) onSave(v); else onCancel();
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
            <Button type="submit" variant="primary" className={sm} disabled={busy || (editing === "identify" && !draft.generic.trim())}>{M(lang, "save")}</Button>
            <Button className={sm} onClick={onCancel}>{M(lang, "cancel")}</Button>
            <p className="text-micro text-ink-soft"><LangMorph text={U.oldStays} lang={lang} /></p>
          </div>
        </form>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-x-4 px-6 pb-2">
            {([["dose", m.dose, prev?.dose], ["frequency", m.frequency, prev?.frequency], ["timing", m.timing, undefined]] as const).map(([k, v, was]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-micro text-ink-soft"><LangMorph text={T[k]} lang={lang} /></dt>
                <dd>{value(v, was)}</dd>
              </div>
            ))}
          </dl>
          {!locked && (
            <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
              {unmatched ? (
                <Button className={sm} variant="primary" disabled={busy} onClick={() => startEdit("identify")}>{M(lang, "identify")}</Button>
              ) : (
                <>
                  <Button className={sm} disabled={busy || stopped || m.status === "verified"} onClick={onVerify}>{M(lang, "verify")}<span className="sr-only">, {m.nameOriginal}</span></Button>
                  <Button className={sm} disabled={busy || stopped} onClick={() => startEdit("edit")}>{M(lang, "edit")}<span className="sr-only">, {m.nameOriginal}</span></Button>
                </>
              )}
              {!stopped && !confirmStop && <Button className={sm} variant="quiet" disabled={busy} onClick={() => setConfirmStop(true)}>{M(lang, "discontinue")}<span className="sr-only">, {m.nameOriginal}</span></Button>}
              {confirmStop && (
                <>
                  <span className="text-small text-ink-soft"><LangMorph text={U.confirmStop} lang={lang} /></span>
                  <Button className={sm} variant="primary" disabled={busy} onClick={() => { setConfirmStop(false); onDiscontinue(); }}>{M(lang, "confirmStopBtn")}</Button>
                  <Button className={sm} onClick={() => setConfirmStop(false)}>{M(lang, "cancel")}</Button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function AllergyRow({ a, lang, pl, busy, locked, selected, linked, editing, onSelect, onEdit, onCancel, onVerify, onSave }: {
  a: AllergyEntry; lang: Lang; pl: Lang; busy: boolean; locked: boolean; selected: boolean; linked: boolean; editing: boolean;
  onSelect: () => void; onEdit: () => void; onCancel: () => void; onVerify: () => void; onSave: (v: { allergenClass?: string; reaction?: string }) => void;
}) {
  const [draft, setDraft] = useState({ allergenClass: "", reaction: "" });
  const pencil = a.status === "unsupported";
  const prev = a.review?.previous;
  const strike = (old: string | null | undefined, now: string | null) => (old && old !== now ? <s className="mx-struck mr-1.5">{old}</s> : null);
  return (
    <li className={cls("border-b border-rule last:border-b-0", (selected || linked) && "bg-paper")}>
      <button type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect} className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-x-4 px-6 py-2.5 text-left hover:bg-paper">
        <span lang={pl} className={cls("font-serif text-lead", pencil && "mx-pencil")}>&ldquo;{a.allergenOriginal}&rdquo;</span>
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-2">
            {pencil ? <PencilField value={a.allergenClass ?? a.allergenOriginal} lang={lang} /> :
              a.status === "unmatched" ? <><span className="mx-blank" aria-hidden="true" /><span className="text-small text-ink-soft"><LangMorph text={L("ไม่รู้จักสารก่อภูมิแพ้ ถามผู้ป่วย", "Allergene non riconosciuto, chiedere al paziente", "Unmatched, ask which medicine")} lang={lang} /></span></> :
                <span className="text-body font-medium">{a.status === "edited" && strike(prev?.allergenClass, a.allergenClass)}{a.allergenClass ?? a.allergenOriginal}</span>}
            {a.status === "verified" && <Badge tone="outline">{M(lang, "verified")}{a.review ? `, ${a.review.reviewerId}` : ""}</Badge>}
            {a.status === "edited" && <span className="text-micro text-ink-soft">{M(lang, "editedBy")}{a.review ? `, ${a.review.reviewerId}` : ""}</span>}
            {linked && <span className="text-micro text-ink-soft">linked to selected alert</span>}
          </span>
          <span className={cls("text-small", pencil ? "text-graphite" : "text-ink-soft")}>
            <LangMorph text={T.reaction} lang={lang} />:{" "}
            {a.status === "edited" && strike(prev?.reaction, a.reaction)}
            {a.reaction ? <span lang={pl} className={pencil ? "mx-pencil" : "text-ink"}>{a.reaction}</span> : <span className="mx-blank" aria-label="Not stated" />}
          </span>
        </span>
      </button>
      {editing ? (
        <form
          className="grid grid-cols-1 gap-3 px-6 pb-3 min-[700px]:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v: { allergenClass?: string; reaction?: string } = {};
            if (draft.allergenClass.trim() !== (a.allergenClass ?? "")) v.allergenClass = draft.allergenClass.trim();
            if (draft.reaction.trim() !== (a.reaction ?? "")) v.reaction = draft.reaction.trim();
            if (Object.keys(v).length) onSave(v); else onCancel();
          }}
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        >
          <Field autoFocus label="Allergen class" maxLength={80} value={draft.allergenClass} onChange={(e) => setDraft({ ...draft, allergenClass: e.target.value })} />
          <Field label="Reaction" maxLength={120} value={draft.reaction} onChange={(e) => setDraft({ ...draft, reaction: e.target.value })} />
          <div className="flex items-center gap-2 min-[700px]:col-span-2">
            <Button type="submit" variant="primary" className={sm} disabled={busy}>{M(lang, "save")}</Button>
            <Button className={sm} onClick={onCancel}>{M(lang, "cancel")}</Button>
            <p className="text-micro text-ink-soft"><LangMorph text={U.oldStays} lang={lang} /></p>
          </div>
        </form>
      ) : !locked ? (
        <div className="flex gap-2 px-6 pb-3">
          <Button className={sm} disabled={busy || a.status === "verified"} onClick={onVerify}>{M(lang, "verify")}<span className="sr-only">, {a.allergenOriginal}</span></Button>
          <Button className={sm} disabled={busy} onClick={() => { setDraft({ allergenClass: a.allergenClass ?? "", reaction: a.reaction ?? "" }); onEdit(); }}>{M(lang, "edit")}<span className="sr-only">, {a.allergenOriginal}</span></Button>
        </div>
      ) : null}
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
  const verb = { acknowledge: L("รับทราบแล้ว", "Preso in carico", "Acknowledged"), resolved: L("จัดการแล้ว", "Risolto", "Resolved"), false_alarm: L("ระบุว่าเป็นการแจ้งเตือนผิด", "Segnato come falso allarme", "Marked false alarm") };
  const btn = { acknowledge: L("รับทราบ", "Prendi in carico", "Acknowledge"), resolved: L("จัดการแล้ว", "Risolto", "Resolved"), false_alarm: L("แจ้งเตือนผิด", "Falso allarme", "False alarm") };
  return (
    <li className={cls("flex flex-col gap-2 border-b border-rule px-4 py-3", urgent && "border-t-2 border-t-signal bg-signal-tint", !urgent && (selected || linked) && "bg-paper")}>
      <button type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect} className={cls("flex flex-wrap items-center gap-x-2 gap-y-1 text-left", selected && "underline underline-offset-4")}>
        <Badge tone={a.severity === "high" ? (open ? "signalOutline" : "outline") : "outline"}>{a.severity === "high" ? L("สูง", "Alto", "High")[lang] : L("ปานกลาง", "Moderato", "Moderate")[lang]}</Badge>
        <span className="text-body font-medium"><LangMorph text={KIND_LABEL[a.kind]} lang={lang} /></span>
        <span className="text-micro text-ink-soft">{a.ruleId}<span className="sr-only">, show in the patient&apos;s words</span></span>
      </button>
      <p className="text-body"><LangMorph text={a.message} lang={lang} /></p>
      <p className="text-small text-ink-soft"><span className="font-medium"><LangMorph text={T.check} lang={lang} />: </span><LangMorph text={a.action} lang={lang} /></p>
      {linkedMeds.length > 0 && (
        <p className="flex flex-wrap gap-x-3 text-small">
          {linkedMeds.map((m) => <button key={m.id} type="button" onClick={() => onShowMed(m.id)} className="underline underline-offset-4">{m.nameOriginal}</button>)}
        </p>
      )}
      <p className="text-micro text-graphite">{a.source}</p>
      {a.review ? (
        <p className="text-small text-ink-soft">
          {verb[a.review.action][lang]}, {a.review.reviewerId}, {clock(a.review.at)}.{a.review.note ? ` ${a.review.note}` : ""}
        </p>
      ) : !locked && !form ? (
        <div className="flex flex-wrap gap-2">
          <Button className={sm} disabled={busy} onClick={() => onReview("acknowledge")}>{btn.acknowledge[lang]}</Button>
          <Button className={sm} disabled={busy} onClick={() => { setForm("resolved"); setNote(""); }}>{btn.resolved[lang]}</Button>
          <Button className={sm} disabled={busy} onClick={() => { setForm("false_alarm"); setNote(""); }}>{btn.false_alarm[lang]}</Button>
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
            label={form === "false_alarm" ? L("ทำไมจึงเป็นการแจ้งเตือนผิด", "Perché è un falso allarme?", "Why is this a false alarm?")[lang] : L("ทำอะไรไปแล้ว (ไม่บังคับ)", "Cosa è stato fatto? (facoltativo)", "What was done? (optional)")[lang]}
            hint={L("การแจ้งเตือนยังอยู่ในบันทึก", "L'avviso resta nel registro.", "The alert stays on the record.")[lang]}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className={sm} disabled={busy || (form === "false_alarm" && !note.trim())}>{M(lang, "save")}</Button>
            <Button className={sm} onClick={() => setForm(null)}>{M(lang, "cancel")}</Button>
          </div>
        </form>
      )}
    </li>
  );
}

function SignOff({ lang, busy, locked, block, error, audit, open, onToggle, onSignOff, reconciledBy, reconciledAt, reviewer, provenance, generatedAt }: {
  lang: Lang; busy: boolean; locked: boolean; block: ReturnType<typeof blockers>; error: string | null; audit: AuditEvent[]; open: boolean; onToggle: () => void; onSignOff: () => void;
  reconciledBy?: string; reconciledAt?: string; reviewer: string; provenance: string; generatedAt?: string;
}) {
  return (
    <footer className="shrink-0 border-t border-rule">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        {!locked && <Button variant="primary" disabled={busy || block.length > 0} aria-describedby="signoff-block" onClick={onSignOff}>{M(lang, "signOff")}</Button>}
        <div className="min-w-0 flex-1 basis-64">
          {error && <p role="alert" className="text-small text-signal">{U.refused[lang]}: {error}</p>}
          {locked ? (
            <p className="text-small text-ink-soft"><Badge tone="ink">{PHARM_STATUS_LABEL.reconciled}</Badge> <span className="ml-1">{reconciledBy ?? "pharmacist"}{reconciledAt ? `, ${clock(reconciledAt)}` : ""}</span></p>
          ) : block.length > 0 ? (
            <p id="signoff-block" role="status" className="text-small text-ink-soft">
              <span className="font-medium text-ink">{U.blocked[lang]}: </span>{block.map((b) => b[lang]).join("; ")}.
            </p>
          ) : (
            <p id="signoff-block" className="text-small text-ink-soft">{U.ready[lang]}. {reviewer}.</p>
          )}
        </div>
      </div>
      <div className="border-t border-rule px-6 py-2">
        <button type="button" aria-expanded={open} aria-controls="audit-log" onClick={onToggle} className="text-small text-ink-soft underline underline-offset-4">
          {open ? "Hide" : "Show"} audit and provenance ({audit.length} events)
        </button>
        <p lang={lang} className="mt-0.5 text-micro text-ink-soft">{U.ruleSet[lang]}</p>
        <p className="text-micro text-graphite">{provenance}{generatedAt ? `, summary ${clock(generatedAt)}` : ""}.</p>
        {open && (
          <ol id="audit-log" className="mt-2 max-h-40 overflow-y-auto border-t border-rule">
            <li lang={lang} className="border-b border-rule py-1.5 text-micro text-graphite">{U.disclaimer[lang]}</li>
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
