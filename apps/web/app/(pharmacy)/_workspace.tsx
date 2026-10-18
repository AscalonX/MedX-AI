"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AllergyEntry, AllergyReviewAction, AuditEvent, IntakeSession, Lang, MedAlert, MedAlertReviewAction, MedicationEntry, MedReviewAction } from "@medx/shared";
import { Badge, Button, Card, CardHeader, EvidenceHighlight, Field, GradientHero, Icon, InkConfidence, LangMorph, PencilField, type Mark } from "@/components/ui";
import {
  C, kindTitle, L, LANG_NAME, PHARM_STATUS_LABEL, U, allergiesOf, alertsOf, auditLine, signOffEvent, blockers, buildQuestions, clock, collectedOrderIds, fetchSession, hasNka, isAbstained,
  medsOf, ordersOf, pharmStatus, redFlagsOf, selEvidence, selKey, waited, alertNeedsFollowUp, type Sel,
} from "./_lib";
import { ABSTAIN, STAGE_LABEL } from "./_lib";
import { PickupCard, PrescriptionsCard } from "./_orders";
import { PhotoCard } from "./_photo";
import { startVisiblePolling } from "../_shared/visiblePolling";
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
/** Visible text chip, never an empty skeleton-like pill. */
const NotStated = ({ lang }: { lang: Lang }) => <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-micro font-semibold text-graphite">{C.notStated[lang]}</span>;

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
  const [auditTick, setAuditTick] = useState(0);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastRow = useRef<HTMLElement | null>(null);

  useEffect(() => { setSel(null); setEdit(null); setActionError(null); setAuditOpen(false); }, [id]);

  // Real audit trail for live sessions. Fixtures keep theirs in the shell. Paused while the tab is hidden.
  const hasEntry = !!entry;
  useEffect(() => {
    if (!hasEntry || fixture) return;
    let dead = false;
    const stop = startVisiblePolling(() => { fetchSession(id).then((d) => !dead && setLiveAudit(d.audit)).catch(() => {}); }, 5000);
    return () => { dead = true; stop(); };
  }, [id, hasEntry, fixture, auditTick]);

  const wide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1600px)").matches;
  // Explicit open (button): move focus into the drawer. Selecting a row opens it without stealing focus.
  const openDrawer = (el: HTMLElement | null) => { triggerRef.current = el; setDrawer(true); if (!wide()) setTimeout(() => closeRef.current?.focus(), 60); };
  const closeDrawer = () => {
    const inside = document.getElementById("transcript")?.contains(document.activeElement);
    setDrawer(false);
    if (inside || triggerRef.current) { const t = triggerRef.current; triggerRef.current = null; setTimeout(() => t?.focus(), 0); }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key !== "Escape" || tag === "INPUT" || tag === "TEXTAREA") return;
      setSel(null); closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A card that shows its own refusal passes onError; otherwise the refusal goes to the sticky sign-off bar.
  const run = useCallback(async (fn: () => Promise<unknown>, onError?: (message: string) => void) => {
    setBusy(true); setActionError(null);
    try { await fn(); return true; }
    catch (e) { const msg = `${(e as Error).message}`; if (onError) onError(msg); else setActionError(msg); return false; }
    finally { setBusy(false); setAuditTick((t) => t + 1); }
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
      <section lang={lang} className="flex flex-1 flex-col gap-3 bg-sheet p-6 shadow-sheet">
        <h1 className="text-title">{L("รายการนี้ไม่มีข้อมูลยา", "Questo accesso non ha dati sui farmaci.", "This intake has no medication data.")[lang]}</h1>
        <p className="text-body text-ink-soft">
          {queueError ? `${C.notRefreshed[lang]}: ${queueError}. ` : ""}
          {L("อาจถูกลบไปแล้ว หรือยังไม่มีสรุปหรือใบสั่งยา", "Potrebbe essere stato rimosso, oppure il riepilogo o gli ordini non ci sono ancora.", "It may have been removed, or there is no summary or prescription yet.")[lang]}
        </p>
        <Link href="/pharmacy" className="text-body underline underline-offset-4">{C.back[lang]}</Link>
      </section>
    );
  }

  const abstained = isAbstained(session);
  // An abstained summary carries no clinical conclusions: nothing below may render from it.
  const meds = abstained ? [] : medsOf(session);
  const allergies = abstained ? [] : allergiesOf(session);
  const alerts = alertsOf(session); // deterministic rule alerts stay visible even when the summary abstained
  const flags = redFlagsOf(session);
  const pl = session.patientLang;
  const st = pharmStatus(session);
  const locked = st === "reconciled";
  const block = blockers(session);
  const questions = buildQuestions(session);
  const nka = !abstained && allergies.length === 0 && hasNka(session);
  const nkaEv = abstained ? [] : session.summary?.noKnownAllergiesEvidence ?? [];
  const audit = fixture ? fixtureAudit[id] ?? [] : liveAudit;
  const collected = collectedOrderIds(audit); // orders handed over in an earlier pickup cycle

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
  const announce = !sel ? "" : activeEv.length ? C.evidenceTurn(session.turns.findIndex((t) => t.id === activeEv[0].turnId) + 1)[lang] : C.noEvidence[lang];

  // Opening from a row records that row as the return target (Safari does not focus buttons on click, so the last pointer-down row is used).
  const select = (s: Sel) => {
    setSel(s);
    if (!drawer) openDrawer(lastRow.current ?? (document.activeElement as HTMLElement | null));
  };
  const selAlert = sel?.type === "alert" ? alerts.find((a) => a.id === sel.id) : undefined;
  const linkedToSel = (kind: "med" | "allergy", itemId: string) => !!selAlert && (kind === "med" ? selAlert.medIds : selAlert.allergyIds).includes(itemId);
  const alertLinkedToSel = (a: MedAlert) => (sel?.type === "med" && a.medIds.includes(sel.id)) || (sel?.type === "allergy" && a.allergyIds.includes(sel.id));

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(scrollRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  const extract = session.summary?.modelCalls.find((c) => c.step === "extract");

  return (
    <div ref={scrollRef} lang={lang} onPointerDownCapture={(e) => { lastRow.current = (e.target as HTMLElement).closest<HTMLElement>("[data-row], button"); }} onKeyDown={moveFocus} className="flex flex-col gap-6">
      <p aria-live="polite" className="sr-only">{announce}</p>
      <h1 className="sr-only">{C.queueTitle[lang]}: {session.code}</h1>

      <GradientHero
        title={<span className="flex flex-wrap items-baseline gap-x-3">{session.code}<span lang={pl} className="text-body font-semibold text-on-primary/90">{LANG_NAME[pl]}</span></span>}
        subtitle={<>{C.started[lang]} {clock(session.createdAt)}{!locked && now > 0 && <>, {C.waiting[lang]} {waited(session.createdAt, now)}</>}</>}
        action={
          <>
            <Link href="/pharmacy" className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 px-4 text-small font-semibold text-on-primary ring-1 ring-inset ring-white/40 hover:bg-white/25">{C.back[lang]}</Link>
            <button type="button" onClick={(e) => openDrawer(e.currentTarget)} aria-controls="transcript" aria-expanded={drawer} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 px-4 text-small font-semibold text-on-primary ring-1 ring-inset ring-white/40 hover:bg-white/25 min-[1600px]:hidden">{C.words[lang]}</button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st === "reconciled" ? "teal" : "outline"}>{PHARM_STATUS_LABEL[st][lang]}</Badge>
            {session.pickup && (
              <Badge tone={session.pickup.status === "collected" ? "teal" : "ocean"} icon={<Icon name={session.pickup.status === "collected" ? "check" : "bell"} size={14} />}>
                {session.pickup.status === "collected" ? L("รับยาแล้ว", "Ritirato", "Collected")[lang] : `${STAGE_LABEL.ready[lang]}${session.pickup.counter ? `, ${L("ช่อง", "sportello", "counter")[lang]} ${session.pickup.counter}` : ""}`}
              </Badge>
            )}
            {fixture && <Badge tone="pencil">{C.fixture[lang]}</Badge>}
          </div>
          <dl className="flex gap-8">
            {([[T.medicines, meds.length], [T.allergies, allergies.length], [T.alerts, alerts.length]] as const).map(([k, n]) => (
              <div key={k.en}>
                <dt className="text-micro font-semibold text-on-primary/85">{k[lang]}</dt>
                <dd className="text-stat font-extrabold tabular-nums">{abstained && k.en !== "Medication alerts" ? "-" : n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </GradientHero>

      <PrescriptionsCard session={session} lang={lang} busy={busy} fixture={fixture} run={run} collected={collected} />
      <PickupCard key={session.id} session={session} lang={lang} busy={busy} run={run} collected={collected} />

      {locked && <Receipt session={session} lang={lang} audit={audit} />}

      {flags.length > 0 && (
        <section aria-labelledby="h-flags" role="alert" className="rounded-card border border-signal/50 bg-signal-tint p-5 ring-1 ring-signal/20">
          <h2 id="h-flags" className="flex items-center gap-2 text-lead font-bold text-signal"><Icon name="triangle-alert" /><LangMorph text={U.flags} lang={lang} /></h2>
          <ul className="mt-3 flex flex-col gap-3">
            {flags.map((h) => (
              <li key={h.ruleId} className="flex flex-col gap-1 rounded-2xl bg-sheet p-3">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={h.severity === "emergency" ? "signal" : "signalOutline"}>{h.severity === "emergency" ? C.emergency[lang] : C.urgent[lang]}</Badge>
                  <span className="text-lead font-bold"><LangMorph text={h.label} lang={lang} /></span>
                  <span className="text-micro text-ink-soft">{h.ruleId}</span>
                </p>
                <p className="text-small"><LangMorph text={h.action} lang={lang} /></p>
                <p className="text-small text-ink-soft">{h.review ? <>{M(lang, "flagDone")} {h.review.reviewerId}, {clock(h.review.at)}</> : <LangMorph text={U.flagOpen} lang={lang} />}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-small"><Link href={`/review/${session.id}`} className="font-semibold text-ocean underline underline-offset-4"><LangMorph text={U.flagReview} lang={lang} /></Link></p>
        </section>
      )}
      {fixture && <p role="note" className="rounded-2xl bg-warn-tint px-4 py-2 text-small text-warn"><LangMorph text={U.fixtureNote} lang={lang} /></p>}

      <div className="grid items-start gap-6 min-[1024px]:grid-cols-[minmax(0,1fr)_340px] min-[1600px]:grid-cols-[minmax(0,1fr)_340px_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {abstained ? (
            <Card aria-labelledby="h-abst">
              <h2 id="h-abst" className="text-title font-extrabold"><LangMorph text={U.needsHuman} lang={lang} /></h2>
              <p className="mt-2 max-w-[60ch] text-body text-ink-soft">
                {session.summary?.abstainReason && ABSTAIN[session.summary.abstainReason] ? <LangMorph text={ABSTAIN[session.summary.abstainReason]} lang={lang} /> : <LangMorph text={U.needsHumanBody} lang={lang} />}
                {". "}<LangMorph text={U.needsHumanBody} lang={lang} />
              </p>
              <p className="mt-3 max-w-[60ch] text-body"><LangMorph text={C.askDirect} lang={lang} /></p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" onClick={(e) => openDrawer(e.currentTarget)} aria-controls="transcript" aria-expanded={drawer}>{C.readWords[lang]}</Button>
                <Link href={`/review/${session.id}`} className="inline-flex h-10 items-center rounded-full border border-rule-strong/60 bg-sheet px-4 text-body font-semibold hover:border-ocean hover:text-ocean"><LangMorph text={U.flagReview} lang={lang} /></Link>
              </div>
            </Card>
          ) : (
            <>
              <Card padded={false} aria-labelledby="h-meds">
                <div className="px-5 pt-5"><CardHeader title={<span id="h-meds"><LangMorph text={T.medicines} lang={lang} /></span>} action={<span className="text-small text-ink-soft">{meds.length}</span>} className="mb-2" /></div>
                {meds.length === 0 ? (
                  <p className="px-5 pb-5 text-body text-ink-soft"><LangMorph text={U.noMeds} lang={lang} /></p>
                ) : (
                  <ul className="divide-y divide-rule/70">
                    {meds.map((m) => (
                      <MedRow
                        key={m.id} m={m} lang={lang} pl={pl} busy={busy} locked={locked}
                        selected={sel?.type === "med" && sel.id === m.id} linked={linkedToSel("med", m.id)}
                        highAlert={alerts.some((a) => a.severity === "high" && alertNeedsFollowUp(a) && a.medIds.includes(m.id))}
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
              </Card>

              {!fixture && <PhotoCard session={session} lang={lang} locked={locked} />}

              <Card padded={false} aria-labelledby="h-alg">
                <div className="px-5 pt-5"><CardHeader title={<span id="h-alg"><LangMorph text={T.allergies} lang={lang} /></span>} className="mb-2" /></div>
                <ul className="divide-y divide-rule/70">
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
                      <button type="button" data-row aria-pressed={sel?.type === "nka"} aria-controls="transcript" onClick={() => select({ type: "nka", id: "nka" })} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-left hover:bg-paper">
                        <Badge tone="ocean" icon={<Icon name="quote" size={14} />}><LangMorph text={U.nka} lang={lang} /></Badge>
                        <span lang={pl} className="text-body text-ink-soft">&ldquo;{nkaEv[0].quote}&rdquo;</span>
                      </button>
                    </li>
                  )}
                  {allergies.length === 0 && !nka && (
                    <li className="flex items-center gap-3 px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-small font-medium text-graphite"><Icon name="circle-minus" size={14} /><LangMorph text={U.notStatedAsk} lang={lang} /></span>
                    </li>
                  )}
                </ul>
              </Card>

              <Card aria-labelledby="h-q">
                <CardHeader title={<span id="h-q"><LangMorph text={T.questions} lang={lang} /></span>} />
                {questions.length === 0 ? (
                  <p className="text-small text-ink-soft"><LangMorph text={L("ไม่มีข้อมูลที่ต้องถามเพิ่ม", "Nessuna domanda in sospeso", "Nothing more to ask")} lang={lang} /></p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {questions.map((qn) => (
                      <li key={qn.id} className="rounded-2xl bg-paper p-4">
                        <p lang={pl} className="max-w-[65ch] text-lead font-bold text-ink">{qn.text[pl]}</p>
                        {lang !== pl && <p lang={lang} className="mt-1 max-w-[70ch] text-small text-ink-soft"><LangMorph text={qn.text} lang={lang} /></p>}
                        <p className="mt-1 text-micro text-graphite">{qn.why[lang]}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </>
          )}
          <Provenance
            lang={lang} audit={audit} session={session} open={auditOpen} onToggle={() => setAuditOpen((o) => !o)}
            provenance={extract ? C.extractedBy(`${extract.provider} / ${extract.model}`)[lang] : C.noExtraction[lang]} generatedAt={session.summary?.generatedAt}
          />
        </div>

        <aside aria-label={T.alerts[lang]} className="min-[1024px]:sticky min-[1024px]:top-4 min-[1024px]:max-h-[calc(100dvh-2rem)] min-[1024px]:overflow-y-auto rounded-card">
          <Card padded={false}>
            <div className="flex items-center gap-3 px-5 pt-5">
              <CardHeader title={<LangMorph text={abstained ? C.safetyAlerts : T.alerts} lang={lang} />} className="mb-2" />
              {alerts.some((a) => a.severity === "high" && alertNeedsFollowUp(a)) && <Badge tone="signalOutline" className="mb-2">{C.highN(alerts.filter((a) => a.severity === "high" && alertNeedsFollowUp(a)).length)[lang]}</Badge>}
            </div>
            {abstained && <p className="px-5 pb-2 text-small text-ink-soft"><LangMorph text={C.safetyAlertsNote} lang={lang} /></p>}
            {alerts.length === 0 ? (
              <p className="px-5 pb-5 text-small text-ink-soft"><LangMorph text={U.noAlerts} lang={lang} /></p>
            ) : (
              <ul className="flex flex-col gap-3 p-4 pt-1">
                {[...alerts].sort((a, b) => Number(alertNeedsFollowUp(b)) - Number(alertNeedsFollowUp(a)) || Number(b.severity === "high") - Number(a.severity === "high")).map((a) => (
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
          </Card>
        </aside>

        <aside
          id="transcript" aria-label={C.words[lang]}
          onKeyDown={(e) => {
            if (e.key !== "Tab" || wide() || !drawer) return;
            const f = [...e.currentTarget.querySelectorAll<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])")];
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }}
          className={cls(
            "flex min-h-0 flex-col rounded-card border border-rule/70 bg-sheet shadow-sheet",
            "min-[1600px]:sticky min-[1600px]:top-4 min-[1600px]:max-h-[calc(100dvh-2rem)]",
            "max-[1599px]:fixed max-[1599px]:inset-y-0 max-[1599px]:right-0 max-[1599px]:z-30 max-[1599px]:w-[400px] max-[1599px]:max-w-full max-[1599px]:rounded-r-none max-[1599px]:shadow-sheet-lifted",
            "max-[1599px]:transition-transform max-[1599px]:duration-base max-[1599px]:ease-pen",
            !drawer && "max-[1599px]:invisible max-[1599px]:translate-x-full",
          )}
        >
          <div className="flex items-center px-5 pb-2 pt-5">
            <h2 className="text-lead font-bold">{C.words[lang]}</h2>
            <button ref={closeRef} type="button" onClick={closeDrawer} className="ml-auto text-small font-semibold text-ocean min-[1600px]:hidden">{C.close[lang]}</button>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {session.turns.map((t, i) => {
              const marks = marksFor(t.id);
              const hasActive = marks.some((m) => m.active);
              return (
                <li key={t.id} className="border-t border-rule/70 py-3 first:border-t-0">
                  <p className="flex gap-2 text-micro text-ink-soft">
                    <span>{i + 1}</span><span>{clock(t.at)}</span><span>{t.role === "patient" ? C.patient[lang] : C.question[lang]}</span><span lang={t.lang}>{LANG_NAME[t.lang]}</span>
                  </p>
                  {t.role === "patient" ? (
                    <EvidenceHighlight key={hasActive ? `${t.id}:${selKey(sel)}` : t.id} text={t.text} lang={t.lang} marks={marks} className="mt-1" />
                  ) : (
                    <p lang={t.lang} className="mt-1 text-body text-ink-soft">{t.text}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <SignOff
        lang={lang} busy={busy} locked={locked} block={block} error={actionError}
        reconciledBy={locked ? session.pharmacyReviewerId : undefined} reconciledAt={locked ? session.updatedAt : undefined}
        onSignOff={() => send([], [], true)} reviewer={reviewer}
      />
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

  const Chip = () => {
    if (unmatched) return <Badge tone="pencil" icon={<Icon name="circle-minus" size={14} />}>{M(lang, "unmatched")}</Badge>;
    if (pencil) return <Badge tone="pencil" icon={<Icon name="triangle-alert" size={14} />}>{M(lang, "needsCheck")}</Badge>;
    if (stopped) return <Badge tone="outline">{M(lang, "stopped")}</Badge>;
    if (m.status === "verified") return <Badge tone="teal" icon={<Icon name="check" size={14} />}>{M(lang, "verified")}{by ? `, ${by}` : ""}</Badge>;
    if (m.status === "edited") return <Badge tone="teal" icon={<Icon name="pencil" size={14} />}>{M(lang, "editedBy")}{by ? `, ${by}` : ""}</Badge>;
    return <Badge tone="ocean" icon={<Icon name="quote" size={14} />}>{M(lang, "fromPatient")}</Badge>;
  };
  const initial = [...m.nameOriginal.replace(/^ยา/, "")][0]?.toUpperCase() ?? "?";
  const sub = (() => {
    if (unmatched) return <span className="inline-flex items-center gap-2"><span className="mx-blank" aria-hidden="true" /></span>;
    if (pencil) return <PencilField value={m.generic ?? m.nameOriginal} lang={lang} />;
    if (stopped) return <s className="mx-struck">{m.generic ?? m.nameOriginal}</s>;
    if (m.status === "edited") return <span>{strike(prev?.generic, m.generic)}<span className="font-semibold text-ink">{m.generic ?? m.nameOriginal}</span></span>;
    if (m.status === "supported") return <InkConfidence confidence={m.confidence} lang={lang}><span className="font-semibold">{m.generic ?? m.nameOriginal}</span></InkConfidence>;
    return <span className="font-semibold text-ink">{m.generic ?? m.nameOriginal}</span>;
  })();
  const value = (v: string | null, was?: string | null) => {
    const struck = m.status === "edited" ? strike(was, v) : null;
    if (!v) return <>{struck}<NotStated lang={lang} /></>;
    return <span lang={pl} className={cls(stopped && "mx-struck", pencil && "mx-pencil")}>{struck}{v}</span>;
  };

  return (
    <li className={cls((selected || linked) && "bg-paper")}>
      <button
        type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors duration-quick ease-pen hover:bg-paper"
      >
        <span aria-hidden="true" className={cls("grid size-11 shrink-0 place-items-center rounded-full text-lead font-bold", pencil ? "bg-warn-tint text-warn" : unmatched || stopped ? "bg-muted text-graphite" : "bg-ocean-tint text-ocean")}>{initial}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span lang={pl} className={cls("text-lead font-bold", stopped && "mx-struck", pencil && "mx-pencil")}>{m.nameOriginal}</span>
          <span className={cls("flex flex-wrap items-center gap-x-2 text-small", pencil ? "text-graphite" : "text-ink-soft")}>
            {sub}<span aria-hidden="true">·</span>{humanClass(m.drugClass) ?? M(lang, "classUnknown")}
          </span>
          <span className="text-small text-ink-soft"><LangMorph text={T.timing} lang={lang} />: {value(m.timing)}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2"><Chip />{highAlert && <Badge tone="signalOutline">{M(lang, "highAlert")}</Badge>}{linked && <span className="text-micro text-ink-soft">{C.linked[lang]}</span>}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right tabular-nums">
          <span className="text-lead font-bold">{value(m.dose, prev?.dose)}</span>
          <span className="text-small text-ink-soft">{value(m.frequency, prev?.frequency)}</span>
          {pl !== lang && (m.dose || m.frequency || m.timing) && <span className="mt-0.5 rounded-full bg-muted px-2 py-0.5 text-micro font-semibold text-graphite">{C.originalLang(LANG_NAME[pl])[lang]}</span>}
        </span>
      </button>
      {editing ? (
        <form
          className="grid grid-cols-1 gap-3 px-5 pb-4 pl-[84px] min-[700px]:grid-cols-3"
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
              <Field autoFocus required maxLength={120} label={C.identifyAs[lang]} hint={C.identifyHint[lang]} value={draft.generic} onChange={(e) => setDraft({ ...draft, generic: e.target.value })} />
            </div>
          ) : (
            <>
              <Field autoFocus label={C.genericName[lang]} maxLength={120} value={draft.generic} onChange={(e) => setDraft({ ...draft, generic: e.target.value })} />
              <Field label={T.dose[lang]} maxLength={60} value={draft.dose} onChange={(e) => setDraft({ ...draft, dose: e.target.value })} />
              <Field label={T.frequency[lang]} maxLength={60} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })} />
            </>
          )}
          <div className="flex flex-wrap items-center gap-2 min-[700px]:col-span-3">
            <Button type="submit" variant="primary" className={sm} disabled={busy || (editing === "identify" && !draft.generic.trim())}>{M(lang, "save")}</Button>
            <Button className={sm} onClick={onCancel}>{M(lang, "cancel")}</Button>
            <p className="text-micro text-ink-soft"><LangMorph text={U.oldStays} lang={lang} /></p>
          </div>
        </form>
      ) : !locked ? (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-4 pl-[84px]">
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
      ) : null}
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
  const chip = pencil ? <Badge tone="pencil" icon={<Icon name="triangle-alert" size={14} />}>{M(lang, "needsCheck")}</Badge>
    : a.status === "unmatched" ? <Badge tone="pencil" icon={<Icon name="circle-minus" size={14} />}>{M(lang, "unmatched")}</Badge>
    : a.status === "verified" ? <Badge tone="teal" icon={<Icon name="check" size={14} />}>{M(lang, "verified")}{a.review ? `, ${a.review.reviewerId}` : ""}</Badge>
    : a.status === "edited" ? <Badge tone="teal" icon={<Icon name="pencil" size={14} />}>{M(lang, "editedBy")}{a.review ? `, ${a.review.reviewerId}` : ""}</Badge>
    : <Badge tone="ocean" icon={<Icon name="quote" size={14} />}>{M(lang, "fromPatient")}</Badge>;
  return (
    <li className={cls((selected || linked) && "bg-paper")}>
      <button type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect} className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors duration-quick ease-pen hover:bg-paper">
        <span aria-hidden="true" className={cls("grid size-11 shrink-0 place-items-center rounded-full", pencil ? "bg-warn-tint text-warn" : "bg-ocean-tint text-ocean")}><Icon name="activity" /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span lang={pl} className={cls("text-lead font-bold", pencil && "mx-pencil")}>{a.allergenOriginal}</span>
          <span className="text-small text-ink-soft">
            {a.status === "unmatched" ? <span className="mx-blank" aria-hidden="true" /> : pencil ? <PencilField value={a.allergenClass ?? a.allergenOriginal} lang={lang} /> : <span className="font-semibold text-ink">{a.status === "edited" && strike(prev?.allergenClass, a.allergenClass)}{a.allergenClass ?? a.allergenOriginal}</span>}
          </span>
          <span className={cls("text-small", pencil ? "text-graphite" : "text-ink-soft")}>
            <LangMorph text={T.reaction} lang={lang} />: {a.status === "edited" && strike(prev?.reaction, a.reaction)}
            {a.reaction ? <span lang={pl} className={pencil ? "mx-pencil" : "text-ink"}>{a.reaction}</span> : <NotStated lang={lang} />}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2">{chip}{linked && <span className="text-micro text-ink-soft">{C.linked[lang]}</span>}</span>
        </span>
      </button>
      {editing ? (
        <form
          className="grid grid-cols-1 gap-3 px-5 pb-4 pl-[84px] min-[700px]:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v: { allergenClass?: string; reaction?: string } = {};
            if (draft.allergenClass.trim() !== (a.allergenClass ?? "")) v.allergenClass = draft.allergenClass.trim();
            if (draft.reaction.trim() !== (a.reaction ?? "")) v.reaction = draft.reaction.trim();
            if (Object.keys(v).length) onSave(v); else onCancel();
          }}
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        >
          <Field autoFocus label={C.allergenClass[lang]} maxLength={80} value={draft.allergenClass} onChange={(e) => setDraft({ ...draft, allergenClass: e.target.value })} />
          <Field label={T.reaction[lang]} maxLength={120} value={draft.reaction} onChange={(e) => setDraft({ ...draft, reaction: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2 min-[700px]:col-span-2">
            <Button type="submit" variant="primary" className={sm} disabled={busy}>{M(lang, "save")}</Button>
            <Button className={sm} onClick={onCancel}>{M(lang, "cancel")}</Button>
            <p className="text-micro text-ink-soft"><LangMorph text={U.oldStays} lang={lang} /></p>
          </div>
        </form>
      ) : !locked ? (
        <div className="flex gap-2 px-5 pb-4 pl-[84px]">
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
  const open = alertNeedsFollowUp(a);
  const high = a.severity === "high" && open; // acknowledged high alerts remain relevant
  const amber = a.severity === "moderate" && open;
  const linkedMeds = a.medIds.map((id) => meds.find((m) => m.id === id)).filter(Boolean) as MedicationEntry[];
  const verb = { acknowledge: L("รับทราบแล้ว", "Preso in carico", "Acknowledged"), resolved: L("จัดการแล้ว", "Risolto", "Resolved"), false_alarm: L("ระบุว่าเป็นการแจ้งเตือนผิด", "Segnato come falso allarme", "Marked false alarm") };
  const btn = { acknowledge: L("รับทราบ", "Prendi in carico", "Acknowledge"), resolved: L("จัดการแล้ว", "Risolto", "Resolved"), false_alarm: L("แจ้งเตือนผิด", "Falso allarme", "False alarm") };
  return (
    <li className={cls("flex flex-col gap-2 rounded-2xl p-4", high ? "border border-signal/50 bg-signal-tint ring-1 ring-signal/20" : amber ? "border border-warn/30 bg-warn-tint" : "border border-rule/70 bg-sheet", (selected || linked) && !high && !amber && "bg-paper")}>
      <button type="button" data-row aria-pressed={selected} aria-controls="transcript" onClick={onSelect} className={cls("flex flex-wrap items-center gap-x-2 gap-y-1 text-left", selected && "underline underline-offset-4")}>
        <span aria-hidden="true" className={cls("grid size-8 place-items-center rounded-full", high ? "bg-signal text-on-signal" : amber ? "bg-warn text-on-primary" : a.severity === "high" ? "bg-signal-tint text-signal" : "bg-muted text-graphite")}><Icon name="triangle-alert" size={16} /></span>
        <Badge tone={a.severity === "high" ? "signalOutline" : "pencil"}>{a.severity === "high" ? L("สูง", "Alto", "High")[lang] : L("ปานกลาง", "Moderato", "Moderate")[lang]}</Badge>
        <span className="text-body font-bold"><LangMorph text={kindTitle(a)} lang={lang} /></span>
        <span className="text-micro text-ink-soft">{a.ruleId}<span className="sr-only">, show in the patient&apos;s words</span></span>
      </button>
      <p className="text-body"><LangMorph text={a.message} lang={lang} /></p>
      <p className="text-small text-ink-soft"><span className="font-semibold"><LangMorph text={T.check} lang={lang} />: </span><LangMorph text={a.action} lang={lang} /></p>
      {linkedMeds.length > 0 && (
        <p className="flex flex-wrap gap-x-3 text-small">
          {linkedMeds.map((m) => <button key={m.id} type="button" onClick={() => onShowMed(m.id)} className="font-semibold text-ocean underline underline-offset-4">{m.nameOriginal}</button>)}
        </p>
      )}
      {linkedMeds.some((m) => m.status === "discontinued" || /stopp|smess|sospe|หยุด/i.test(m.timing ?? "")) && (
        <p className="flex items-center gap-1.5 rounded-xl bg-warn-tint px-3 py-1.5 text-small font-semibold text-warn"><Icon name="triangle-alert" size={14} />{C.statedStopped[lang]}</p>
      )}
      <p className="text-micro text-graphite">{a.source}</p>
      {a.review && (
        <p className="text-small text-ink-soft">{verb[a.review.action][lang]}, {a.review.reviewerId}, {clock(a.review.at)}.{a.review.note ? ` ${a.review.note}` : ""}</p>
      )}
      {open && !locked && !form && (
        <div className="flex flex-wrap gap-2">
          {!a.review && <Button className={sm} disabled={busy} onClick={() => onReview("acknowledge")}>{btn.acknowledge[lang]}</Button>}
          <Button className={sm} disabled={busy} onClick={() => { setForm("resolved"); setNote(""); }}>{btn.resolved[lang]}</Button>
          <Button className={sm} disabled={busy} onClick={() => { setForm("false_alarm"); setNote(""); }}>{btn.false_alarm[lang]}</Button>
        </div>
      )}
      {open && !locked && !form && <p className="text-micro text-graphite">{C.alertHelp[lang]}</p>}
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

/** Sticky sign-off pill: the button plus the reason it is blocked, in the clinician language. */
function SignOff({ lang, busy, locked, block, error, onSignOff, reconciledBy, reconciledAt, reviewer }: {
  lang: Lang; busy: boolean; locked: boolean; block: ReturnType<typeof blockers>; error: string | null; onSignOff: () => void;
  reconciledBy?: string; reconciledAt?: string; reviewer: string;
}) {
  if (locked && !error) return null; // the receipt card replaces the bar
  return (
    <div className="sticky bottom-4 z-20">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[28px] border border-rule/70 bg-sheet px-4 py-3 shadow-sheet-lifted">
        {!locked && <Button variant="primary" size="lg" disabled={busy || block.length > 0} aria-describedby="signoff-block" onClick={onSignOff} icon={<Icon name="circle-check" />}>{M(lang, "signOff")}</Button>}
        <div className="min-w-0 flex-1 basis-64">
          {error && <p role="alert" className="text-small font-semibold text-signal">{U.refused[lang]}: {error}</p>}
          {locked ? (
            <p className="text-small text-ink-soft"><Badge tone="teal" icon={<Icon name="check" size={14} />}>{PHARM_STATUS_LABEL.reconciled[lang]}</Badge> <span className="ml-1">{reconciledBy ?? "pharmacist"}{reconciledAt ? `, ${clock(reconciledAt)}` : ""}</span></p>
          ) : block.length > 0 ? (
            <p id="signoff-block" role="status" className="text-small text-warn">
              <span className="font-bold">{U.blocked[lang]}: </span>{block.map((b) => b[lang]).join("; ")}.
            </p>
          ) : (
            <div id="signoff-block" className="text-small text-ink-soft"><p>{U.ready[lang]}. {reviewer}.</p><p className="mt-1 text-micro">{U.reviewScope[lang]}</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

function Provenance({ lang, audit, session, open, onToggle, provenance, generatedAt }: {
  lang: Lang; audit: AuditEvent[]; session: IntakeSession; open: boolean; onToggle: () => void; provenance: string; generatedAt?: string;
}) {
  const ctx = { orders: ordersOf(session) }; // lets order events name the drug
  return (
    <Card aria-label="Audit and provenance">
      <p lang={lang} className="text-small text-ink-soft">{U.ruleSet[lang]}</p>
      <p className="mt-1 text-micro text-graphite">{provenance}{generatedAt ? `, ${C.summaryAt[lang]} ${clock(generatedAt)}` : ""}.</p>
      <button type="button" aria-expanded={open} aria-controls="audit-log" onClick={onToggle} className="mt-2 inline-flex items-center gap-1.5 text-small font-semibold text-ocean underline underline-offset-4">
        <Icon name="scroll-text" size={16} />{C.showAudit(open, audit.length)[lang]}
      </button>
      {open && (
        <ol id="audit-log" className="mt-2 max-h-72 overflow-y-auto border-t border-rule/70">
          <li lang={lang} className="border-b border-rule/70 py-1.5 text-micro text-graphite">{U.disclaimer[lang]}</li>
          {audit.length === 0 && <li className="py-1.5 text-small text-ink-soft">{C.noPharmActions[lang]}.</li>}
          {audit.map((e) => (
            <li key={e.id} className="flex gap-3 border-b border-rule/70 py-1.5 text-small last:border-b-0">
              <span className="w-14 shrink-0 text-ink-soft tabular-nums">{clock(e.at)}</span>
              <span className="min-w-0">{auditLine(e, lang, ctx)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Teal receipt after sign-off: who, when, and what was reconciled. Mirrors the clinician approval receipt. */
function Receipt({ session, lang, audit }: { session: IntakeSession; lang: Lang; audit: AuditEvent[] }) {
  const ev = signOffEvent(audit);
  const meds = medsOf(session), alg = allergiesOf(session), al = alertsOf(session);
  const n = (st: string) => meds.filter((m) => m.status === st).length;
  const rv = (a: string) => al.filter((x) => x.review?.action === a).length;
  const when = ev ? new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", hour12: false }).format(new Date(ev.at)) : "";
  return (
    <section role="status" aria-label={C.signedOffAnnounce[lang]} className="rounded-card border border-teal/30 bg-teal-tint p-5">
      <h2 className="flex items-center gap-2 text-lead font-bold text-teal"><Icon name="circle-check" />{C.receiptTitle[lang]}</h2>
      <p className="mt-1 text-body text-ink">{C.receiptBy[lang]} {ev?.actorId ?? session.pharmacyReviewerId ?? "pharmacist"}{when ? `, ${when}` : ""}</p>
      <ul className="mt-3 flex flex-col gap-1 text-small text-ink-soft">
        <li>{C.receiptMeds(meds.length, n("verified"), n("edited"), n("discontinued"))[lang]}</li>
        <li>{C.receiptAllergies(alg.length, alg.length === 0 && hasNka(session))[lang]}</li>
        <li>{C.receiptAlerts(al.length, rv("acknowledge"), rv("resolved"), rv("false_alarm"))[lang]}</li>
      </ul>
      <p className="mt-3 text-micro text-graphite">{C.receiptNote[lang]}</p>
    </section>
  );
}
