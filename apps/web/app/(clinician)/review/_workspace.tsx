"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditEvent, Evidence, ExtractedField, FieldKey, IntakeSession, Lang, RedFlagHit, RedFlagReviewAction, ReviewAction, SessionStatus } from "@medx/shared";
import { Badge, Button, Card, EvidenceHighlight, FieldValue, GradientHero, Icon, LangMorph, RedFlagInterrupt, buttonClasses, type IconName, type Mark } from "@/components/ui";
import { StageChip } from "../../_shared/StageChip";
import { useVisiblePolling } from "../../_shared/visiblePolling";
import { FIELD_GROUPS, FIELD_LABEL, LANG_NAME, auditRow, clock, fetchSession, post, waited, type AuditCtx } from "./_lib";
import { fmt, tr, type TKey } from "./_i18n";
import { Complaint, FlagChip, LangBadge, StatusChip, returnedOrders } from "./_queue";
import { returnReport } from "./_stage";
import { useClinician } from "./_shell";
import { ct } from "./[id]/consult/_c18n";

/** The consult accepts lines in these states (engine consult.ts); collecting stays with the patient, taken over is closed. */
const CONSULT_OPEN: SessionStatus[] = ["awaiting_review", "needs_human", "escalated", "approved"];

type Sel = { type: "field"; key: FieldKey } | { type: "flag"; key: string };
const selId = (s: Sel | null) => (s ? `${s.type}:${s.key}` : "");
const sm = "h-8! px-3! text-small!";

export function Workspace({ id }: { id: string }) {
  const { lang, reviewer, now, refreshQueue, sorted, markOpened, clinicianRole } = useClinician();
  const [data, setData] = useState<{ session: IntakeSession; audit: AuditEvent[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [drawer, setDrawer] = useState(false);
  const trigger = useRef<HTMLElement | null>(null); // the control that opened the drawer, so focus can return to it
  const openDrawer = (e: React.MouseEvent<HTMLElement>) => { trigger.current = e.currentTarget; setDrawer(true); };
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [prev, setPrev] = useState<Partial<Record<FieldKey, string>>>({});
  const busyRef = useRef(false);
  const gen = useRef(0); // bumped on every mutation and id change; older GET responses are dropped
  const scrollRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState("");
  useEffect(() => { markOpened(id); }, [id, markOpened]);
  // When the last edit or approval completes the case, bring the receipt into view, focus it and announce it.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1279px)").matches;
    if (drawer && narrow && trigger.current) setTimeout(() => document.getElementById("transcript-close")?.focus(), 60);
    if (!drawer && trigger.current) { const t = trigger.current; trigger.current = null; if (narrow) setTimeout(() => t.focus(), 0); }
  }, [drawer]);
  const status = data?.session.status;
  const prevStatus = useRef<string | undefined>(undefined);
  const code = data?.session.code ?? "";
  const [health, setHealth] = useState<{ provider: string; model: string; hardware: string } | null>(null);
  useEffect(() => { fetch("/api/health", { cache: "no-store" }).then((r) => r.json()).then(setHealth).catch(() => setHealth(null)); }, []);
  useEffect(() => {
    if (status === "approved" && prevStatus.current && prevStatus.current !== "approved") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => {
        headRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
        headRef.current?.focus({ preventScroll: true });
      }, 80);
      setLive(`${tr("approvedReceipt", lang)} · ${code}`);
    }
    prevStatus.current = status;
  }, [status, lang, code]);

  const reqId = useRef(0);
  const inflight = useRef(false);
  // Single flight for polls; `force` (after a mutation) always issues a new request. Only the newest request may write state.
  const load = useCallback(async (force = false) => {
    if (busyRef.current) return;
    if (inflight.current && !force) return;
    inflight.current = true;
    const g = gen.current;
    const mine = ++reqId.current;
    try {
      const d = await fetchSession(id);
      if (g !== gen.current || mine !== reqId.current) return; // a mutation, navigation, unmount or newer request happened meanwhile
      setData(d);
      setLoadError(null);
    } catch (e) {
      if (g === gen.current && mine === reqId.current) setLoadError((e as Error).message);
    } finally {
      if (mine === reqId.current) inflight.current = false;
    }
  }, [id]);

  useEffect(() => {
    gen.current++;
    prevStatus.current = undefined; setData(null); setLive(""); setSel(null); setEditing(null); setPrev({}); setActionError(null); setAuditOpen(false); setLoadError(null);
    scrollRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { gen.current++; reqId.current++; inflight.current = false; }; // cancel on unmount or id change
  }, [id]);
  // First load at once, then every 5 s while the tab is visible; paused while hidden, at once when it comes back (C-03).
  useVisiblePolling(() => { void load(); }, 5000, id);

  // Escape clears the highlight (DIRECTION 6a) and closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement).tagName === "INPUT") return;
      setSel(null); setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    gen.current++; busyRef.current = true; setBusy(true); setActionError(null);
    try { await fn(); return true; }
    catch (e) { setActionError((e as Error).message); return false; }
    finally { gen.current++; busyRef.current = false; setBusy(false); await load(true); refreshQueue(); }
  }, [load, refreshQueue]);

  if (!data) {
    return (
      <Card aria-busy="true" className="flex flex-col gap-4">
        {loadError ? (
          <p role="alert" className="text-body text-signal">{tr("loadFailed", lang)}: {loadError}. <button className="font-semibold text-ocean underline" onClick={() => load(true)}>{tr("retry", lang)}</button></p>
        ) : (
          [0, 1, 2, 3].map((i) => <span key={i} className="mx-skeleton !h-12" />)
        )}
      </Card>
    );
  }

  const { session, audit } = data;
  const summary = session.summary;
  const hits = summary?.redFlags ?? [];
  const pendingFlags = hits.some((h) => !h.review);
  const hasFlags = hits.length > 0;
  const fields = summary?.fields ?? [];
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const closed = session.status === "taken_over";
  const canAct = !!summary && !summary.abstained && session.status !== "collecting" && !closed;
  const supportedCount = fields.filter((f) => f.status === "supported" && f.value).length;
  const redCalls = summary?.modelCalls.filter((c) => c.step === "red_flags") ?? [];
  const screenDown = redCalls.length > 0 && !redCalls.some((c) => c.ok);
  const nextCase = sorted && sorted.length > 1 ? sorted[(sorted.findIndex((s) => s.id === id) + 1) % sorted.length] : null;

  // Who touched which field, from the audit log.
  const touched = new Map<string, string>();
  for (const e of audit) {
    if (e.type !== "review") continue;
    for (const a of (e.payload.actions as ReviewAction[] | undefined) ?? []) if (a.action !== "reject") touched.set(a.fieldKey, e.actorId ?? "clinician");
  }
  const takeoverBy = audit.find((e) => e.type === "takeover")?.actorId;

  // After a state change, announce it and move focus to the resulting status so keyboard and screen-reader users keep their place.
  const settle = (msg: string) => {
    setLive(msg);
    setTimeout(() => headRef.current?.focus(), 60);
  };
  const sendReview = async (actions: ReviewAction[], flags?: RedFlagReviewAction[]) => {
    const ok = await run(() => post(`/api/sessions/${id}/review`, { reviewerId: reviewer, actions, ...(flags ? { redFlagActions: flags } : {}) }));
    if (ok && flags?.length) settle(fmt(tr(flags.every((f) => f.action === "false_alarm") ? "liveFalse" : "liveAcked", lang), { who: reviewer }));
    else if (ok && actions.length > 1) settle(fmt(tr("liveApproved", lang), { who: reviewer }));
    return ok;
  };

  const select = (s: Sel) => { setSel(s); setDrawer(true); };

  // Evidence marks per turn: every quote in use is dotted; the selection is highlighted.
  const evidenceOf = (s: Sel | null): Evidence[] =>
    !s ? [] : s.type === "field" ? byKey.get(s.key as FieldKey)?.evidence ?? [] : hits.find((h) => h.ruleId === s.key)?.evidence ?? [];
  const activeEv = evidenceOf(sel);
  const used: Evidence[] = [...fields.flatMap((f) => f.evidence), ...hits.flatMap((h) => h.evidence)];
  const marksFor = (turnId: string): Mark[] =>
    [...used, ...activeEv].filter((e) => e.turnId === turnId).map((e) => ({
      start: e.start, end: e.end, quote: e.quote, active: activeEv.some((a) => a.turnId === e.turnId && a.start === e.start && a.end === e.end),
    }));
  // Clinician-language gloss for a patient turn, from values the pipeline already verified against the quote. Never machine-translated here.
  const glossFor = (turnId: string) => {
    const out: { quote: string; label: string; text: string; correction?: boolean }[] = [];
    const editedKeys = new Set<string>();
    for (const e of audit) if (e.type === "review") for (const a of (e.payload.actions as ReviewAction[] | undefined) ?? []) if (a.action === "edit") editedKeys.add(a.fieldKey);
    for (const f of fields) {
      const v = f.value?.[lang];
      if (!v || !["supported", "approved", "edited"].includes(f.status)) continue;
      if (!f.evidence.some((e) => e.turnId === turnId)) continue;
      // A clinician-entered value is never shown as the translation of the patient's quote.
      if (f.status === "edited" || editedKeys.has(f.key)) out.push({ quote: "", label: FIELD_LABEL[f.key][lang], text: v, correction: true });
      else for (const e of f.evidence) if (e.turnId === turnId) out.push({ quote: e.quote, label: FIELD_LABEL[f.key][lang], text: v });
    }
    for (const h of hits) for (const e of h.evidence) if (e.turnId === turnId) out.push({ quote: e.quote, label: tr("redFlag", lang), text: h.label[lang] });
    return out.filter((g, i) => out.findIndex((o) => o.quote === g.quote && o.text === g.text) === i);
  };
  const announce = !sel ? "" : activeEv.length
    ? `Evidence, turn ${session.turns.findIndex((t) => t.id === activeEv[0].turnId) + 1}`
    : "No evidence quote for this item";

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(scrollRef.current?.querySelectorAll<HTMLElement>("[data-field-row]") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  const flagReview = (
    <FlagReview hits={hits} lang={lang} busy={busy} selected={sel?.type === "flag" ? sel.key : null} onShow={(r) => select({ type: "flag", key: r })} onReview={(a) => sendReview([], [a])} />
  );

  // Patient header: the one gradient hero, replaced by a plain card while a red flag is the bold element.
  const waitText = session.status !== "approved" && now > 0 ? `${tr("waiting", lang)} ${waited(session.createdAt, now, tr("min", lang))}` : null;
  const consultOpen = CONSULT_OPEN.includes(session.status);
  const row = sorted?.find((s) => s.id === id);
  const approvedEv = [...audit].reverse().find((e) => e.type === "review");
  const nextOpen = sorted?.find((x) => x.id !== id && (x.status === "escalated" || x.status === "awaiting_review")) ?? nextCase;
  /**
   * Case actions, the same set on every header (M-06): the consult (whenever the engine accepts consult lines,
   * approved cases included), vitals, orders and the case trace; then the queue and the next case.
   * `tone`: "hero" white pills on the gradient, "plain" on a white card, "receipt" on the approved receipt.
   */
  const headerActions = (tone: "hero" | "plain" | "receipt") => {
    const pill = (primary = false) =>
      buttonClasses({ variant: tone === "hero" ? "onDark" : primary ? "primary" : "secondary", size: "md", className: "text-small!" });
    const link = (href: string, icon: IconName, label: string, primary = false, title?: string) => (
      <Link href={href} title={title} className={pill(primary)}><Icon name={icon} size={14} />{label}</Link>
    );
    const consultPrimary = tone === "plain" || (tone === "receipt" && clinicianRole === "doctor");
    const next = tone === "receipt" ? nextOpen : nextCase;
    return (
      <>
        {consultOpen && link(`/review/${id}/consult?mode=${clinicianRole}`, "mic", ct(clinicianRole === "doctor" ? "startDoctor" : "startNurse", lang), consultPrimary)}
        {link(`/review/${id}/vitals`, "activity", ct("vitals", lang))}
        {link(`/review/${id}/orders`, "pill", ct("orders", lang))}
        {link(`/review/${id}/trace`, "route", tr("caseTrace", lang), false, tr("caseTraceHint", lang))}
        <span aria-hidden="true" className={`mx-0.5 hidden h-6 w-px self-center sm:block ${tone === "hero" ? "bg-white/30" : "bg-rule"}`} />
        <Link href="/review" className={pill()}><Icon name="chevron-right" size={14} className="rotate-180" />{tr("navQueue", lang)}</Link>
        {next && (
          <Link href={`/review/${next.id}`} className={pill(tone === "receipt" && !consultPrimary)}>
            {tr("nextCase", lang)} <span className="tabular-nums">{next.code}</span><Icon name="chevron-right" size={14} />
          </Link>
        )}
        <button type="button" onClick={openDrawer} aria-expanded={drawer} aria-controls="transcript" className={`${pill()} min-[1280px]:hidden`}>
          <Icon name="quote" size={14} />{tr("patientsWords", lang)}
        </button>
      </>
    );
  };
  const triage = session.triage;
  const conf = triage?.confirmed;
  const moreUrgent = !!triage && !!conf && triage.suggestedLevel < conf.level;
  const triageRow = (hero: boolean) => triage ? (
    <Link href={`/review/${id}/vitals`} className={`mt-2 flex flex-wrap items-center gap-2 text-small font-semibold ${hero ? "text-on-primary" : "text-ink"}`}>
      <span className={hero ? "rounded-full bg-white/15 px-3 py-0.5" : "rounded-full bg-muted px-3 py-0.5"}>
        {conf ? fmt(tr("triageConfirmed", lang), { n: conf.level }) : fmt(tr("triageSuggested", lang), { n: triage.suggestedLevel })}
      </span>
      {triage.warningScore !== undefined && <span className={hero ? "rounded-full bg-white/15 px-3 py-0.5" : "rounded-full bg-muted px-3 py-0.5"}>{fmt(tr("news2", lang), { n: triage.warningScore })}</span>}
      {moreUrgent && <span className="rounded-full bg-signal-tint px-3 py-0.5 text-signal">{fmt(tr("triageReconfirm", lang), { n: triage.suggestedLevel })}</span>}
      <span className="underline underline-offset-4">{tr("vitalsLink", lang)}</span>
    </Link>
  ) : null;
  const headerMeta = (hero: boolean) => (
    <span className="flex flex-wrap items-center gap-2">
      <StatusChip s={session} lang={lang} />
      <FlagChip s={session} lang={lang} />
      <StageChip s={session} stage={row?.stage} lang={lang} />
      <span lang={session.patientLang} className={hero ? "rounded-full bg-white/15 px-3 py-0.5 text-small font-semibold" : "rounded-full bg-muted px-3 py-0.5 text-small font-semibold text-ink-soft"}>
        {LANG_NAME[session.patientLang]}
      </span>
      <span className={hero ? "text-small" : "text-small text-ink-soft"}>
        {tr("started", lang)} {clock(session.createdAt, lang)}{waitText ? `, ${waitText}` : ""}
      </span>
    </span>
  );
  const complaint = <Complaint s={session} lang={lang} onDark={!hasFlags} />;
  const codeTitle = <span className="text-stat font-extrabold tabular-nums">{session.code}</span>;
  const approver = approvedEv?.actorId ?? reviewer;
  const approvedCount = fields.filter((f) => f.status === "approved" || f.status === "edited").length;
  // Approved receipt (DIRECTION 6f). The case stays open: every case action is still here (M-06).
  const headerBlock = session.status === "approved" && !hasFlags ? (
    <Card className="cl-enter flex flex-col gap-4 border-teal/30 !bg-teal-tint" data-receipt="approved">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-teal text-on-primary"><Icon name="circle-check" size={24} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-title font-extrabold text-teal">{tr("approvedReceipt", lang)} · <span className="tabular-nums">{session.code}</span></h1>
          <p className="text-small text-ink-soft">{approver}, {clock(approvedEv?.at ?? session.updatedAt, lang)} · {fmt(tr("receiptFields", lang), { n: approvedCount })}</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl bg-sheet/80 px-4 py-3 text-small sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-ink-soft">{tr("stageLabel", lang)}</dt>
        <dd className="flex flex-wrap items-center gap-2">
          {row?.stage ? <StageChip s={session} stage={row.stage} lang={lang} /> : <span className="text-graphite">-</span>}
          <span lang={session.patientLang} className="rounded-full bg-muted px-2.5 py-0.5 text-micro font-semibold text-ink-soft">{LANG_NAME[session.patientLang]}</span>
        </dd>
        {triage && (
          <>
            <dt className="text-ink-soft">{tr("vitalsLink", lang)}</dt>
            <dd className="font-semibold text-ink">
              {conf ? fmt(tr("triageConfirmed", lang), { n: conf.level }) : fmt(tr("triageSuggested", lang), { n: triage.suggestedLevel })}
              {triage.warningScore !== undefined && <span className="font-normal text-ink-soft"> · {fmt(tr("news2", lang), { n: triage.warningScore })}</span>}
              {moreUrgent && <span className="ml-2 rounded-full bg-signal-tint px-2.5 py-0.5 text-micro text-signal">{fmt(tr("triageReconfirm", lang), { n: triage.suggestedLevel })}</span>}
            </dd>
          </>
        )}
      </dl>
      <p className="text-small text-ink-soft">{tr("receiptNext", lang)}</p>
      <div role="group" aria-label={tr("caseActions", lang)} className="flex flex-wrap items-center gap-2">{headerActions("receipt")}</div>
    </Card>
  ) : hasFlags ? (
    <Card className="cl-enter flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <LangBadge lang={session.patientLang} />
        <div className="min-w-0">
          <h1 className="text-title font-extrabold tabular-nums">{session.code}</h1>
          <p className="truncate text-small text-ink-soft">{complaint}</p>
        </div>
      </div>
      {headerMeta(false)}
      {triageRow(false)}
      <div role="group" aria-label={tr("caseActions", lang)} className="flex flex-wrap items-center gap-2">{headerActions("plain")}</div>
    </Card>
  ) : (
    <GradientHero
      className="cl-enter"
      title={<span className="flex items-center gap-3">{codeTitle}</span>}
      subtitle={<span className="block text-lead font-semibold text-on-primary">{complaint}</span>}
      action={<div role="group" aria-label={tr("caseActions", lang)} className="flex flex-wrap items-center gap-2">{headerActions("hero")}</div>}
    >
      {headerMeta(true)}
      {triageRow(true)}
    </GradientHero>
  );
  const header = <div ref={headRef} tabIndex={-1} className="outline-none">{headerBlock}</div>;

  const note = "rounded-2xl bg-muted px-4 py-2.5 text-small text-ink-soft";
  const sheet = (
    <>
      {header}
      {screenDown && <p role="status" className={note}>{tr("screenDown", lang)}</p>}
      {returnedOrders(session).length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn/40 bg-warn-tint px-4 py-3 text-small text-warn">
          <Icon name="triangle-alert" size={16} />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{tr("returnedBanner", lang)}</p>
            {returnedOrders(session).map((o) => {
              const report = returnReport(o);
              return (
                <div key={o.id} className="mt-0.5">
                  <p>{o.drugText}{o.dose ? ` ${o.dose}` : ""}{o.pharmacist?.note ? `. ${tr("pharmacistNote", lang)}: ${o.pharmacist.note}` : ""}</p>
                  {report && report.flagged.length > 0 && (
                    <p className="text-ink-soft">{tr("reportFlagged", lang)}: {report.flagged.map((c) => c.message[lang] || c.message.en).join("; ")}</p>
                  )}
                  {report && report.options.length > 0 && (
                    <p className="text-ink-soft">{tr("reportOptions", lang)}: <span className="font-semibold text-ink">{report.options.join(", ")}</span></p>
                  )}
                </div>
              );
            })}
          </div>
          <Link href={`/review/${id}/orders`} className="inline-flex h-9 items-center gap-1 rounded-full bg-sheet px-4 font-semibold text-ocean">{tr("openOrders", lang)}<Icon name="chevron-right" size={14} /></Link>
        </div>
      )}
      {session.status === "escalated" && summary && !summary.abstained && fields.some((f) => f.required && f.status === "missing") && <p className={note}>{tr("stoppedBanner", lang)}</p>}
      {session.status === "collecting" && <p className={note}>{tr("stillAnswering", lang)}</p>}
      {closed && (
        <p className={note}>
          {tr("takenOver", lang)}{takeoverBy ? ` ${tr("takenOverBy", lang)} ${takeoverBy}` : ""}. {tr("personHandling", lang)}{summary && !summary.abstained ? ` ${tr("readOnly", lang)}` : ""}
        </p>
      )}

      {!summary ? (
        <Card><p className="text-body text-ink-soft">{tr("noAnswers", lang)}</p></Card>
      ) : summary.abstained ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-title font-bold">{tr("needsPerson", lang)}</h2>
          <p className="max-w-[60ch] text-body text-ink-soft">
            {summary.abstainReason ? tr(`ar_${summary.abstainReason}` as TKey, lang) : tr("abstainFallback", lang)} {tr("noValuesShown", lang)}
          </p>
        </Card>
      ) : (
        <div onKeyDown={moveFocus} className="flex flex-col gap-4">
          {FIELD_GROUPS.map((g) => (
            <Card key={g.id} padded={false} className="cl-enter" role="group" aria-labelledby={`g-${g.id}`}>
              <h2 id={`g-${g.id}`} className={g.keys.length > 1 ? "px-5 pb-1 pt-4 text-small font-bold text-ink-soft" : "sr-only"}>
                <LangMorph text={g.title} lang={lang} />
              </h2>
              <ul className="p-2">
                {g.keys.map((k) => {
                  const f = byKey.get(k);
                  return f ? (
                    <FieldRow
                      key={k}
                      f={f}
                      lang={lang}
                      patientLang={session.patientLang}
                      selected={sel?.type === "field" && sel.key === k}
                      editing={editing === k}
                      busy={busy}
                      canAct={canAct}
                      blocked={pendingFlags}
                      stopped={session.status === "escalated"}
                      previous={prev[k]}
                      reviewerOf={touched.get(k)}
                      onSelect={() => select({ type: "field", key: k })}
                      onEdit={() => setEditing(k)}
                      onCancel={() => setEditing(null)}
                      onSave={async (value) => {
                        const before = f.status === "missing" ? undefined : f.value?.[lang];
                        const ok = await sendReview([{ fieldKey: k, action: "edit", newValue: value }]);
                        if (ok) { setEditing(null); setPrev((p) => ({ ...p, [k]: before && before !== value ? before : undefined })); }
                      }}
                      onApprove={() => sendReview([{ fieldKey: k, action: "approve" }])}
                      onReject={() => sendReview([{ fieldKey: k, action: "reject" }])}
                    />
                  ) : null;
                })}
              </ul>
            </Card>
          ))}
          <Unknowns fields={fields} lang={lang} />
          {summary.nextQuestion && session.status === "collecting" && (
            <p className={note}>
              {tr("followUp", lang)} ({LANG_NAME[session.patientLang]}): <LangMorph text={summary.nextQuestion.text} lang={lang} />
            </p>
          )}
        </div>
      )}
      <Provenance s={session} lang={lang} health={health} />
    </>
  );

  const allFalseAlarm = hasFlags && !pendingFlags && hits.some((h) => h.review?.action === "false_alarm");
  const wrapped = <div className="flex flex-col gap-4 px-3 pt-4">{hasFlags && flagReview}{sheet}</div>;

  return (
    <div className="cl-workspace grid h-[calc(100dvh-9rem)] min-h-[560px] grid-cols-1 gap-6 min-[1280px]:grid-cols-[minmax(0,1fr)_400px]">
      <p aria-live="polite" className="sr-only">{announce}</p>
      <p role="status" aria-live="polite" className="sr-only">{live}</p>
      <section aria-label={`Summary ${session.code}`} className="flex min-h-0 min-w-0 flex-col gap-3">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
          {allFalseAlarm ? (
            // RedFlagInterrupt's collapsed strip always says "Acknowledged", so false alarms get their own one-line strip.
            <>
              <section
                role="status"
                lang={lang}
                className={`mx-3 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card px-5 py-3 text-small font-medium ${hits.some((h) => h.severity === "emergency") ? "bg-signal-gradient text-on-signal" : "bg-signal-tint text-ink ring-1 ring-inset ring-signal/40"}`}
              >
                <Icon name="triangle-alert" size={16} />
                <span className="font-bold">{tr("redFlag", lang)}</span>
                <span>{hits.map((h) => h.label[lang]).join("; ")}</span>
                <span className="ml-auto">
                  {hits.every((h) => h.review?.action === "false_alarm")
                    ? tr("falseAlarmNoted", lang)
                    : hits.map((h) => `${h.ruleId}: ${tr(h.review?.action === "false_alarm" ? "falseAlarmNoted" : "acknowledged", lang)}`).join("; ")}
                </span>
              </section>
              {wrapped}
            </>
          ) : hasFlags ? (
            <RedFlagInterrupt
              key={id}
              hits={hits}
              lang={lang}
              patientLang={session.patientLang}
              acknowledged={!pendingFlags}
              onAcknowledge={() =>
                sendReview([], hits.filter((h) => !h.review).map((h) => ({ ruleId: h.ruleId, action: "acknowledge" as const })))
              }
            >
              {wrapped}
            </RedFlagInterrupt>
          ) : (
            <div className="flex flex-col gap-4">{sheet}</div>
          )}
        </div>
        <ActionBar
          lang={lang}
          approved={session.status === "approved"}
          busy={busy}
          canAct={canAct}
          closed={closed}
          blocked={pendingFlags}
          supportedCount={supportedCount}
          stopped={session.status === "escalated"}
          left={fields.filter((f) => f.required && (f.status === "missing" || f.status === "unsupported")).map((f) => ({ key: f.key, label: FIELD_LABEL[f.key][lang] }))}
          onJump={(k) => { const el = scrollRef.current?.querySelector<HTMLElement>(`[data-field-key="${k}"]`); el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.focus(); }}
          error={actionError ?? (loadError ? `${tr("notRefreshed", lang)}: ${loadError}` : null)}
          audit={audit}
          auditCtx={{ medications: session.orders?.medications, investigations: session.orders?.investigations }}
          open={auditOpen}
          onToggle={() => setAuditOpen((o) => !o)}
          onApproveAll={() => sendReview(fields.filter((f) => f.status === "supported" && f.value).map((f) => ({ fieldKey: f.key, action: "approve" as const })))}
          onTakeover={async (reason) => {
            const ok = await run(() => post(`/api/sessions/${id}/takeover`, { reviewerId: reviewer, ...(reason ? { reason } : {}) }));
            if (ok) settle(fmt(tr("liveTaken", lang), { who: reviewer }));
          }}
        />
      </section>

      <aside
        id="transcript"
        aria-label={tr("patientsWords", lang)}
        className={[
          "flex min-h-0 flex-col rounded-card border border-rule/70 bg-sheet shadow-sheet",
          "max-[1279px]:fixed max-[1279px]:inset-y-3 max-[1279px]:right-3 max-[1279px]:z-20 max-[1279px]:w-[400px] max-[1279px]:max-w-[calc(100%-1.5rem)] max-[1279px]:shadow-sheet-lifted",
          "max-[1279px]:transition-transform max-[1279px]:duration-base max-[1279px]:ease-pen",
          drawer ? "" : "max-[1279px]:invisible max-[1279px]:translate-x-[110%]",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <Icon name="quote" size={18} className="text-ocean" />
          <h2 className="text-lead font-bold">{tr("patientsWords", lang)}</h2>
          <Button id="transcript-close" variant="quiet" className="ml-auto h-8! px-3! text-small! min-[1280px]:hidden" onClick={() => setDrawer(false)}>{tr("close", lang)}</Button>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {session.turns.length === 0 && <li className="py-3 text-small text-ink-soft">{tr("noWords", lang)}</li>}
          {session.turns.map((t, i) => {
            const marks = marksFor(t.id);
            const hasActive = marks.some((m) => m.active);
            return (
              <li key={t.id} className="border-t border-rule/70 py-3 first:border-t-0">
                <p className="flex items-center gap-2 text-micro text-graphite">
                  <span className="tabular-nums">{i + 1}</span><span className="tabular-nums">{clock(t.at, lang)}</span>
                  <span className="font-semibold text-ink-soft">{t.role === "patient" ? tr("patient", lang) : tr("question", lang)}</span>
                  <span lang={t.lang}>{LANG_NAME[t.lang]}</span>
                  {t.role === "patient" && <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-ink-soft">{tr(t.inputMode === "voice" ? "tagSpoken" : "tagTyped", lang)}</span>}
                </p>
                {t.role === "patient" ? (
                  <>
                    <EvidenceHighlight key={hasActive ? `${t.id}:${selId(sel)}` : t.id} text={t.text} lang={t.lang} marks={marks} className="mt-1" />
                    {t.lang !== lang && (() => {
                      const gl = glossFor(t.id);
                      return gl.length ? (
                        <ul className="mt-2 flex flex-col gap-1 rounded-2xl bg-paper px-3 py-2 text-small text-ink-soft">
                          {gl.map((g, gi) => (
                            <li key={gi}>
                              {g.correction ? (
                                <span lang={lang}><span className="font-semibold text-teal">{tr("clinicianCorrection", lang)}:</span> {g.label}: {g.text}</span>
                              ) : (
                                <>
                                  <span lang={t.lang} className="font-semibold text-ink">“{g.quote}”</span> <span aria-hidden="true">→</span>{" "}
                                  <span className="sr-only">{tr("glossIn", lang)} </span>
                                  <span lang={lang}>{g.label}: {g.text}</span>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5"><span className="rounded-full bg-muted px-2.5 py-0.5 text-micro font-semibold text-ink-soft">{tr("originalLang", lang)}</span></p>
                      );
                    })()}
                  </>
                ) : (
                  <p lang={t.lang} className="mt-1 text-body text-ink-soft">{t.text}</p>
                )}
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}

function FlagReview({ hits, lang, busy, selected, onShow, onReview }: {
  hits: RedFlagHit[]; lang: Lang; busy: boolean; selected: string | null; onShow: (ruleId: string) => void; onReview: (a: RedFlagReviewAction) => void;
}) {
  const [falseFor, setFalseFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  return (
    <ul aria-label={tr("flagReview", lang)} className="overflow-hidden rounded-card border border-signal/30 bg-sheet shadow-sheet">
      {hits.map((h) => (
        <li key={h.ruleId} className="flex flex-col gap-2 border-b border-rule/70 px-5 py-3 last:border-b-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button
              type="button"
              aria-pressed={selected === h.ruleId}
              aria-controls="transcript"
              onClick={() => onShow(h.ruleId)}
              className={`rounded-full px-2 py-0.5 text-left text-small font-bold underline underline-offset-4 ${selected === h.ruleId ? "bg-highlighter" : ""}`}
            >
              {h.ruleId}
              <span className="sr-only">, {tr("showInWords", lang)}</span>
            </button>
            {h.source === "model" ? <Badge tone="pencil" icon={<Icon name="triangle-alert" size={12} />}>{tr("modelSuggested", lang)}</Badge> : <Badge tone="outline">{tr("rule", lang)}</Badge>}
            <span className="text-small text-ink-soft"><LangMorph text={h.label} lang={lang} /></span>
            {h.review ? (
              <span className="ml-auto text-small text-ink-soft">
                {tr(h.review.action === "acknowledge" ? "acknowledgedBy" : "falseAlarmBy", lang)} {h.review.reviewerId}, {clock(h.review.at, lang)}
                {h.review.note ? `. ${tr("note", lang)}: ${h.review.note}` : ""}
              </span>
            ) : (
              <span className="ml-auto flex gap-2">
                <Button className={sm} disabled={busy} aria-label={fmt(tr("falseAlarmAria", lang), { id: h.ruleId })} onClick={() => { setFalseFor(h.ruleId); setNote(""); }}>{tr("falseAlarm", lang)}</Button>
              </span>
            )}
          </div>
          {falseFor === h.ruleId && !h.review && (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); if (note.trim()) { onReview({ ruleId: h.ruleId, action: "false_alarm", note: note.trim() }); setFalseFor(null); } }}
            >
              <label className="text-small text-ink-soft" htmlFor={`fa-${h.ruleId}`}>{tr("falseAlarmWhy", lang)}</label>
              <input
                id={`fa-${h.ruleId}`} autoFocus required value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                className="h-9 min-w-64 flex-1 rounded-control border border-rule-strong/60 bg-sheet px-3 text-body"
              />
              <Button type="submit" variant="primary" className={sm} disabled={busy || !note.trim()}>{tr("recordFalseAlarm", lang)}</Button>
              <Button className={sm} onClick={() => setFalseFor(null)}>{tr("cancel", lang)}</Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

function FieldRow({ f, lang, patientLang, selected, editing, busy, canAct, blocked, stopped, previous, reviewerOf, onSelect, onEdit, onCancel, onSave, onApprove, onReject }: {
  f: ExtractedField; lang: Lang; patientLang: Lang; selected: boolean; editing: boolean; busy: boolean; canAct: boolean; blocked: boolean; stopped: boolean;
  previous?: string; reviewerOf?: string;
  onSelect: () => void; onEdit: () => void; onCancel: () => void; onSave: (v: string) => void; onApprove: () => void; onReject: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);
  useEffect(() => { if (!selected) setConfirmReject(false); }, [selected]);
  const current = f.value?.[lang] ?? "";
  const label = (
    <span className="flex flex-col pt-0.5">
      <span className="text-small font-semibold text-ink-soft"><LangMorph text={FIELD_LABEL[f.key]} lang={lang} /></span>
      {f.required && <span className="text-micro text-graphite">{tr("required", lang)}</span>}
    </span>
  );

  if (editing) {
    return (
      <li className="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-4 rounded-2xl bg-paper px-3 py-3">
        {label}
        <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) onSave(draft.trim()); }} className="flex flex-wrap items-center gap-2">
          <input
            autoFocus aria-label={`Edit ${FIELD_LABEL[f.key].en}`} value={draft} maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
            className="h-10 min-w-56 flex-1 rounded-control border border-rule-strong/60 bg-sheet px-3 text-body hover:border-ocean"
          />
          <Button type="submit" variant="primary" className={sm} disabled={busy || !draft.trim()}>{tr("save", lang)}</Button>
          <Button className={sm} onClick={onCancel}>{tr("cancel", lang)}</Button>
          {current && <p className="basis-full text-micro text-ink-soft">{tr("oldStruck", lang)}</p>}
        </form>
      </li>
    );
  }

  const unsupported = f.status === "unsupported";
  const startEdit = () => { setDraft(current); onEdit(); };
  return (
    <li className={`rounded-2xl transition-colors duration-quick ease-pen ${selected ? "bg-paper ring-1 ring-inset ring-ocean/40" : ""}`}>
      <button
        type="button"
        data-field-row
        data-field-key={f.key}
        aria-pressed={selected}
        aria-controls="transcript"
        onClick={(e) => { e.currentTarget.focus(); onSelect(); }} // Safari does not focus buttons on click
        onFocus={onSelect}
        className="grid w-full grid-cols-[150px_minmax(0,1fr)] items-start gap-4 rounded-2xl px-3 py-3 text-left transition-colors duration-quick ease-pen hover:bg-paper focus-visible:-outline-offset-2"
      >
        {label}
        <span className="flex flex-col gap-1">
          <FieldValue field={f} lang={lang} previousValue={previous} reviewer={reviewerOf} />
          {(f.status === "supported" || f.status === "approved") && f.valueOriginal && f.valueOriginal !== current && (
            <span className="text-micro text-ink-soft">
              {tr("patientWrote", lang)} <span lang={patientLang}>{f.valueOriginal}</span>
            </span>
          )}
          {f.required && f.status === "missing" && !stopped && <span className="text-micro font-semibold text-warn">{tr("reqMissing", lang)}</span>}
        </span>
      </button>
      {selected && canAct && (
        <div className="flex flex-wrap items-center gap-2 pb-3 pl-[178px] pr-3">
          {f.status === "supported" && <Button className={sm} variant="primary" icon={<Icon name="check" size={14} />} disabled={busy || blocked} onClick={onApprove}>{tr("approve", lang)}</Button>}
          {unsupported && <Button className={sm} variant="primary" disabled={busy || blocked} onClick={() => onSave(current)}>{tr("confirmAsWritten", lang)}</Button>}
          <Button className={sm} icon={<Icon name="pencil" size={14} />} disabled={busy} onClick={startEdit}>{tr(f.status === "missing" ? "fillIn" : "edit", lang)}</Button>
          {f.status !== "missing" && !confirmReject && <Button className={sm} variant="quiet" disabled={busy} onClick={() => setConfirmReject(true)}>{tr("reject", lang)}</Button>}
          {confirmReject && (
            <>
              <span className="text-small text-ink-soft">{tr("removeValue", lang)}</span>
              <Button className={sm} disabled={busy} onClick={() => { setConfirmReject(false); onReject(); }}>{tr("rejectValue", lang)}</Button>
              <Button className={sm} variant="quiet" onClick={() => setConfirmReject(false)}>{tr("keep", lang)}</Button>
            </>
          )}
          {blocked && (f.status === "supported" || unsupported) && <span className="text-micro font-semibold text-warn">{tr("ackFirst", lang)}</span>}
        </div>
      )}
    </li>
  );
}

function Unknowns({ fields, lang }: { fields: ExtractedField[]; lang: Lang }) {
  const names = (st: ExtractedField["status"]) => fields.filter((f) => f.status === st);
  const missing = names("missing");
  const pencil = names("unsupported");
  if (!missing.length && !pencil.length) return null;
  const join = (list: ExtractedField[]) => list.map((f, i) => (
    <span key={f.key}>{i > 0 && ", "}<LangMorph text={FIELD_LABEL[f.key]} lang={lang} /></span>
  ));
  return (
    <Card aria-label={`${tr("notKnown", lang)} ${tr("unverifiedPencil", lang)}`} role="region" className="flex flex-col gap-1.5 !p-4 text-small">
      {missing.length > 0 && <p className="text-ink-soft"><span className="font-bold">{tr("notKnown", lang)}</span> {join(missing)}</p>}
      {pencil.length > 0 && <p className="text-warn"><span className="font-bold">{tr("unverifiedPencil", lang)}</span> {join(pencil)}</p>}
    </Card>
  );
}

function Provenance({ s, lang, health }: { s: IntakeSession; lang: Lang; health: { provider: string; model: string; hardware: string } | null }) {
  const calls = s.summary?.modelCalls ?? [];
  if (!calls.length) return null;
  // Attribute per step: the headline follows the extract call that succeeded, never a failed or unrelated call.
  const ex = [...calls].reverse().find((c) => c.step === "extract" && c.ok);
  // Provider, model and hardware exactly as the engine reports them; never a hard-coded hardware claim.
  const head = !ex ? null : ex.provider === "amd-tokenfactory" ? ex.model : tr("mockModel", lang);
  const hw = ex?.provider === "amd-tokenfactory" && health?.provider === "amd-tokenfactory" && health.hardware ? health.hardware : null;
  const name = (p: string) => (p === "amd-tokenfactory" ? "AMD" : "mock");
  return (
    <footer className="flex flex-col gap-0.5 px-2 pb-2 text-micro text-ink-soft">
      <p>
        {head && <><span className="font-semibold">{head}</span> ({ex!.provider}{hw ? `, ${hw}` : ""}). </>}
        {calls.map((c, i) => (
          <span key={i}>{i > 0 && ", "}{tr(`step_${c.step}` as TKey, lang)}: {name(c.provider)} {c.latencyMs} ms{c.ok ? "" : ` (${tr("failed", lang)})`}</span>
        ))}
        . {tr("generated", lang)} {clock(s.summary!.generatedAt, lang)}.
      </p>
      <p>{tr("decisionSupport", lang)}</p>
    </footer>
  );
}

function ActionBar({ lang, approved, busy, canAct, closed, blocked, supportedCount, left, onJump, stopped, error, audit, auditCtx, open, onToggle, onApproveAll, onTakeover }: {
  lang: Lang; approved: boolean; busy: boolean; canAct: boolean; closed: boolean; blocked: boolean; supportedCount: number; stopped: boolean; left: { key: string; label: string }[]; onJump: (k: string) => void; error: string | null; audit: AuditEvent[]; auditCtx: AuditCtx;
  open: boolean; onToggle: () => void; onApproveAll: () => void; onTakeover: (reason: string) => void;
}) {
  const [taking, setTaking] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Card padded={false} className="shrink-0 shadow-sheet-lifted">
      {open && (
        <div id="audit" className="max-h-52 overflow-y-auto border-b border-rule/70 px-5 py-3">
          <h2 className="pb-1 text-small font-bold">{tr("auditTrail", lang)}</h2>
          <table className="w-full text-small">
            <tbody>
              {mergeAudit(audit, lang, auditCtx).map((r) => (
                <tr key={r.id} className="align-baseline">
                  <td className="whitespace-nowrap pr-3 tabular-nums text-ink-soft">{clock(r.at, lang)}</td>
                  <td className="whitespace-nowrap pr-3 text-ink-soft">{r.who}</td>
                  <td>
                    {r.text}{r.n > 1 ? ` ×${r.n}` : ""}
                    {r.chip && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-micro font-semibold text-ink-soft">{r.chip}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canAct && left.length > 0 && !taking && !stopped && (
        <p className="px-5 pt-3 text-small text-ink-soft">
          {(() => {
            const [a, b] = fmt(tr(left.length === 1 ? "leftHint1" : "leftHint", lang), { n: left.length, names: "\u0000" }).split("\u0000");
            return (
              <>
                {a}
                {left.map((l, i) => (
                  <span key={l.key}>{i > 0 && ", "}<button type="button" onClick={() => onJump(l.key)} className="font-semibold text-ocean underline underline-offset-4">{l.label}</button></span>
                ))}
                {b}
              </>
            );
          })()}
        </p>
      )}
      {error && <p role="alert" className="px-5 pt-3 text-small font-semibold text-signal">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {taking ? (
          <form className="flex flex-1 flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); onTakeover(reason.trim()); setTaking(false); }}>
            <label htmlFor="takeover-reason" className="text-small text-ink-soft">{tr("reasonOptional", lang)}</label>
            <input id="takeover-reason" autoFocus value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className="h-10 min-w-48 flex-1 rounded-control border border-rule-strong/60 bg-sheet px-3 text-body" />
            <Button type="submit" variant="primary" disabled={busy}>{tr("takeOver", lang)}</Button>
            <Button onClick={() => setTaking(false)}>{tr("cancel", lang)}</Button>
          </form>
        ) : (
          <>
            <Button variant="primary" icon={<Icon name="circle-check" size={16} />} disabled={busy || !canAct || supportedCount === 0 || blocked} onClick={onApproveAll}>
              {tr("approveSupported", lang)}{supportedCount > 0 ? ` (${supportedCount})` : ""}
            </Button>
            <Button disabled={busy || closed || approved} aria-describedby={approved ? "takeover-why" : undefined} title={approved ? tr("takeOverApproved", lang) : undefined} onClick={() => setTaking(true)}>{tr("takeOverIntake", lang)}</Button>
            {approved && <span id="takeover-why" className="sr-only">{tr("takeOverApproved", lang)}</span>}
            {blocked && <span className="text-small font-semibold text-warn">{tr("ackFirstShort", lang)}</span>}
          </>
        )}
        <Button variant="quiet" className="ml-auto" aria-expanded={open} aria-controls="audit" onClick={onToggle}>
          {tr(open ? "hideAudit" : "auditTrail", lang)}
        </Button>
      </div>
    </Card>
  );
}

/** Merge consecutive identical events, localize actors, and show model and latency on model events. */
function mergeAudit(audit: AuditEvent[], lang: Lang, ctx: AuditCtx) {
  const rows: { id: string; at: string; who: string; text: string; n: number; chip?: string }[] = [];
  for (const e of audit) {
    const { who, text } = auditRow(e, lang, ctx);
    if (!text) continue;
    const calls = Array.isArray((e.payload as { modelCalls?: unknown }).modelCalls) ? ((e.payload as { modelCalls: { model: string; latencyMs: number }[] }).modelCalls) : [];
    const chip = calls.length ? `${calls[0].model} · ${calls.reduce((a, c) => a + c.latencyMs, 0)} ms` : undefined;
    const last = rows[rows.length - 1];
    if (last && last.who === who && last.text === text) { last.n++; last.at = e.at; if (chip) last.chip = chip; }
    else rows.push({ id: e.id, at: e.at, who, text, n: 1, chip });
  }
  return rows;
}
