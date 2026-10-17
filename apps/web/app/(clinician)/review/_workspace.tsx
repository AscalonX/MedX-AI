"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditEvent, Evidence, ExtractedField, FieldKey, IntakeSession, Lang, RedFlagHit, RedFlagReviewAction, ReviewAction } from "@medx/shared";
import { Badge, Button, EvidenceHighlight, FieldValue, RedFlagInterrupt, type Mark } from "@/components/ui";
import { Morph as LangMorph } from "./_morph";
import {
  ABSTAIN_REASON, FIELD_GROUPS, FIELD_LABEL, LANG_NAME, STATUS_LABEL, STEP_LABEL, auditLine, clock, fetchSession, post, topSeverity, waited,
} from "./_lib";
import { useClinician } from "./_shell";

type Sel = { type: "field"; key: FieldKey } | { type: "flag"; key: string };
const selId = (s: Sel | null) => (s ? `${s.type}:${s.key}` : "");

export function Workspace({ id }: { id: string }) {
  const { lang, reviewer, now, refreshQueue } = useClinician();
  const [data, setData] = useState<{ session: IntakeSession; audit: AuditEvent[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [prev, setPrev] = useState<Partial<Record<FieldKey, string>>>({});
  const busyRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const d = await fetchSession(id);
      setData((cur) => (cur && cur.session.id !== id ? cur : d));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setData(null); setSel(null); setEditing(null); setPrev({}); setActionError(null); setAuditOpen(false); setLoadError(null);
    scrollRef.current?.scrollTo({ top: 0 });
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id, load]);

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
    busyRef.current = true; setBusy(true); setActionError(null);
    try { await fn(); return true; }
    catch (e) { setActionError((e as Error).message); return false; }
    finally { busyRef.current = false; setBusy(false); await load(); refreshQueue(); }
  }, [load, refreshQueue]);

  if (!data) {
    return (
      <section aria-busy="true" aria-label="Loading intake" className="flex flex-1 flex-col gap-4 bg-sheet p-6 shadow-sheet">
        {loadError ? (
          <p role="alert" className="text-body text-signal">Could not load this intake: {loadError}. <button className="underline" onClick={load}>Try again</button></p>
        ) : (
          [0, 1, 2, 3, 4].map((i) => <span key={i} className="mx-blank !block !h-5 !w-full" />)
        )}
      </section>
    );
  }

  const { session, audit } = data;
  const summary = session.summary;
  const hits = summary?.redFlags ?? [];
  const pendingFlags = hits.some((h) => !h.review);
  const fields = summary?.fields ?? [];
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const closed = session.status === "taken_over";
  const canAct = !!summary && !summary.abstained && session.status !== "collecting" && !closed;
  const supportedCount = fields.filter((f) => f.status === "supported" && f.value).length;
  const redCalls = summary?.modelCalls.filter((c) => c.step === "red_flags") ?? [];
  const screenDown = redCalls.length > 0 && !redCalls.some((c) => c.ok);

  // Who touched which field, from the audit log.
  const touched = new Map<string, string>();
  for (const e of audit) {
    if (e.type !== "review") continue;
    for (const a of (e.payload.actions as ReviewAction[] | undefined) ?? []) if (a.action !== "reject") touched.set(a.fieldKey, e.actorId ?? "clinician");
  }
  const takeoverBy = audit.find((e) => e.type === "takeover")?.actorId;

  const sendReview = (actions: ReviewAction[], flags?: RedFlagReviewAction[]) =>
    run(() => post(`/api/sessions/${id}/review`, { reviewerId: reviewer, actions, ...(flags ? { redFlagActions: flags } : {}) }));

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

  const sheet = (
    <>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-6 pb-3 pt-5">
        <h1 className="text-title">{session.code}</h1>
        <span lang={session.patientLang} className="text-body text-ink-soft">{LANG_NAME[session.patientLang]}</span>
        <span className="text-small text-ink-soft">
          started {clock(session.createdAt)}
          {session.status !== "approved" && now > 0 && <>, waiting {waited(session.createdAt, now)}</>}
        </span>
        <StatusBadge s={session} />
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-controls="transcript"
          className="ml-auto text-small underline underline-offset-4 min-[1280px]:hidden"
        >
          Patient&apos;s words
        </button>
      </header>
      <div className="flex flex-col gap-2 px-6 empty:hidden">
        {screenDown && (
          <p role="status" className="border-y border-rule py-2 text-small text-ink-soft">
            Model safety screen unavailable. Rules still active.
          </p>
        )}
        {session.status === "collecting" && (
          <p className="border-y border-rule py-2 text-small text-ink-soft">The patient is still answering. Review opens when the summary is ready.</p>
        )}
        {closed && (
          <p className="border-y border-rule py-2 text-small text-ink-soft">
            Taken over{takeoverBy ? ` by ${takeoverBy}` : ""}. A person is handling this intake.{summary && !summary.abstained ? " The summary below is read only." : ""}
          </p>
        )}
      </div>

      {!summary ? (
        <p className="px-6 py-6 text-body text-ink-soft">No answers yet. The summary appears when the patient writes.</p>
      ) : summary.abstained ? (
        <div className="flex flex-col gap-3 px-6 py-6">
          <h2 className="text-title">This intake needs a person to review it.</h2>
          <p className="max-w-[60ch] text-body text-ink-soft">
            {summary.abstainReason ? ABSTAIN_REASON[summary.abstainReason] : "The system could not produce a summary it can stand behind."} No values are shown.
            Read the patient&apos;s words and take over.
          </p>
        </div>
      ) : (
        <div onKeyDown={moveFocus}>
          {FIELD_GROUPS.map((g) => (
            <section key={g.id} aria-labelledby={`g-${g.id}`} className="border-t border-rule pb-1 pt-3">
              <h2 id={`g-${g.id}`} className={g.keys.length > 1 ? "px-6 pb-1 font-sans text-small font-medium text-ink-soft" : "sr-only"}>
                <LangMorph text={g.title} lang={lang} />
              </h2>
              <ul>
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
            </section>
          ))}
          <Unknowns fields={fields} lang={lang} />
          {summary.nextQuestion && session.status === "collecting" && (
            <p className="border-t border-rule px-6 py-3 text-small text-ink-soft">
              Follow-up asked ({LANG_NAME[session.patientLang]}): <LangMorph text={summary.nextQuestion.text} lang={lang} />
            </p>
          )}
        </div>
      )}
      <Provenance s={session} />
    </>
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 min-[1280px]:grid-cols-[minmax(0,1fr)_400px]">
      <p aria-live="polite" className="sr-only">{announce}</p>
      <section aria-label={`Summary for ${session.code}`} className="flex min-h-0 min-w-0 flex-col bg-sheet shadow-sheet">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {hits.length > 0 ? (
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
              <FlagReview hits={hits} lang={lang} busy={busy} selected={sel?.type === "flag" ? sel.key : null} onShow={(r) => select({ type: "flag", key: r })} onReview={(a) => sendReview([], [a])} />
              {sheet}
            </RedFlagInterrupt>
          ) : (
            sheet
          )}
        </div>
        <ActionBar
          busy={busy}
          canAct={canAct}
          closed={closed}
          blocked={pendingFlags}
          supportedCount={supportedCount}
          error={actionError ?? (loadError ? `Not refreshed: ${loadError}` : null)}
          audit={audit}
          open={auditOpen}
          onToggle={() => setAuditOpen((o) => !o)}
          onApproveAll={() => sendReview(fields.filter((f) => f.status === "supported" && f.value).map((f) => ({ fieldKey: f.key, action: "approve" as const })))}
          onTakeover={(reason) => run(() => post(`/api/sessions/${id}/takeover`, { reviewerId: reviewer, ...(reason ? { reason } : {}) }))}
        />
      </section>

      <aside
        id="transcript"
        aria-label="Patient's words"
        className={[
          "flex min-h-0 flex-col bg-sheet shadow-sheet",
          "max-[1279px]:fixed max-[1279px]:inset-y-0 max-[1279px]:right-0 max-[1279px]:z-20 max-[1279px]:w-[400px] max-[1279px]:max-w-full max-[1279px]:shadow-sheet-lifted",
          "max-[1279px]:transition-transform max-[1279px]:duration-base max-[1279px]:ease-pen",
          drawer ? "" : "max-[1279px]:invisible max-[1279px]:translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center border-b border-rule px-4 py-3">
          <h2 className="text-body">Patient&apos;s words</h2>
          <button type="button" onClick={() => setDrawer(false)} className="ml-auto text-small underline underline-offset-4 min-[1280px]:hidden">Close</button>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto">
          {session.turns.length === 0 && <li className="p-4 text-small text-ink-soft">No words yet.</li>}
          {session.turns.map((t, i) => {
            const marks = marksFor(t.id);
            const hasActive = marks.some((m) => m.active);
            return (
              <li key={t.id} className="border-b border-rule px-4 py-3">
                <p className="flex gap-2 text-micro text-ink-soft">
                  <span>{i + 1}</span><span>{clock(t.at)}</span>
                  <span>{t.role === "patient" ? "Patient" : "Question"}</span>
                  <span lang={t.lang}>{LANG_NAME[t.lang]}</span>
                </p>
                {t.role === "patient" ? (
                  <EvidenceHighlight key={hasActive ? `${t.id}:${selId(sel)}` : t.id} text={t.text} lang={t.lang} marks={marks} className="mt-1" />
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

function StatusBadge({ s }: { s: IntakeSession }) {
  const sev = topSeverity(s);
  if (s.status === "escalated") return <Badge tone={sev === "emergency" ? "signal" : "signalOutline"}>{sev === "emergency" ? "Emergency" : "Urgent"}</Badge>;
  return <Badge tone={s.status === "approved" ? "ink" : s.status === "needs_human" || s.status === "collecting" ? "pencil" : "outline"}>{STATUS_LABEL[s.status]}</Badge>;
}

function FlagReview({ hits, lang, busy, selected, onShow, onReview }: {
  hits: RedFlagHit[]; lang: Lang; busy: boolean; selected: string | null; onShow: (ruleId: string) => void; onReview: (a: RedFlagReviewAction) => void;
}) {
  const [falseFor, setFalseFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  return (
    <ul aria-label="Red flag review" className="border-b-2 border-signal bg-sheet">
      {hits.map((h) => (
        <li key={h.ruleId} className="flex flex-col gap-2 border-b border-rule px-6 py-3 last:border-b-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button
              type="button"
              aria-pressed={selected === h.ruleId}
              aria-controls="transcript"
              onClick={() => onShow(h.ruleId)}
              className={`text-left text-small ${selected === h.ruleId ? "bg-paper" : ""} underline underline-offset-4`}
            >
              <span className="font-medium">{h.ruleId}</span>
              <span className="sr-only">, show in the patient&apos;s words</span>
            </button>
            {h.source === "model" ? <Badge tone="pencil">Model-suggested, confirm</Badge> : <Badge tone="outline">Rule</Badge>}
            <span className="text-small text-ink-soft"><LangMorph text={h.label} lang={lang} /></span>
            {h.review ? (
              <span className="ml-auto text-small text-ink-soft">
                {h.review.action === "acknowledge" ? "Acknowledged" : "Marked false alarm"} by {h.review.reviewerId}, {clock(h.review.at)}
                {h.review.note ? `. Note: ${h.review.note}` : ""}
              </span>
            ) : (
              <span className="ml-auto flex gap-2">
                <Button className="h-7! px-2! text-small!" disabled={busy} onClick={() => onReview({ ruleId: h.ruleId, action: "acknowledge" })}>Acknowledge</Button>
                <Button className="h-7! px-2! text-small!" disabled={busy} onClick={() => { setFalseFor(h.ruleId); setNote(""); }}>Mark false alarm</Button>
              </span>
            )}
          </div>
          {falseFor === h.ruleId && !h.review && (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); if (note.trim()) { onReview({ ruleId: h.ruleId, action: "false_alarm", note: note.trim() }); setFalseFor(null); } }}
            >
              <label className="text-small text-ink-soft" htmlFor={`fa-${h.ruleId}`}>Why is this a false alarm? The flag stays on the record.</label>
              <input
                id={`fa-${h.ruleId}`} autoFocus required value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                className="h-8 min-w-64 flex-1 rounded-control border border-rule-strong bg-sheet px-2 text-body"
              />
              <Button type="submit" variant="primary" className="h-8! px-3!" disabled={busy || !note.trim()}>Record false alarm</Button>
              <Button className="h-8! px-3!" onClick={() => setFalseFor(null)}>Cancel</Button>
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
    <span className="flex flex-col">
      <span className="text-small font-medium text-ink-soft"><LangMorph text={FIELD_LABEL[f.key]} lang={lang} /></span>
      {f.required && <span className="text-micro text-graphite">required</span>}
    </span>
  );
  const sm = "h-7! px-2! text-small!";

  if (editing) {
    return (
      <li className="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-4 bg-paper px-6 py-2.5">
        {label}
        <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) onSave(draft.trim()); }} className="flex flex-wrap items-center gap-2">
          <input
            autoFocus aria-label={`Edit ${FIELD_LABEL[f.key].en}`} value={draft} maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
            className="h-9 min-w-56 flex-1 rounded-control border border-rule-strong bg-sheet px-3 text-body hover:border-ink"
          />
          <Button type="submit" variant="primary" className={sm} disabled={busy || !draft.trim()}>Save</Button>
          <Button className={sm} onClick={onCancel}>Cancel</Button>
          {current && <p className="basis-full text-micro text-ink-soft">The old value stays visible, struck through.</p>}
        </form>
      </li>
    );
  }

  const unsupported = f.status === "unsupported";
  const startEdit = () => { setDraft(current); onEdit(); };
  return (
    <li className={selected ? "bg-paper" : ""}>
      <button
        type="button"
        data-field-row
        aria-pressed={selected}
        aria-controls="transcript"
        onClick={(e) => { e.currentTarget.focus(); onSelect(); }} // Safari does not focus buttons on click
        onFocus={onSelect}
        className="grid w-full grid-cols-[160px_minmax(0,1fr)] items-baseline gap-4 px-6 py-2.5 text-left transition-colors duration-quick ease-pen hover:bg-paper focus-visible:-outline-offset-2"
      >
        {label}
        <span className="flex flex-col gap-0.5">
          <FieldValue field={f} lang={lang} previousValue={previous} reviewer={reviewerOf} />
          {(f.status === "supported" || f.status === "approved") && f.valueOriginal && f.valueOriginal !== current && (
            <span className="text-micro text-ink-soft">
              Patient wrote: <span lang={patientLang}>{f.valueOriginal}</span>
            </span>
          )}
          {f.required && f.status === "missing" && <span className="text-micro font-medium text-ink">{stopped ? "Required, not captured: the intake stopped at the red flag." : "Required and not known. Ask the patient."}</span>}
        </span>
      </button>
      {selected && canAct && (
        <div className="flex flex-wrap items-center gap-2 pb-2.5 pl-[184px] pr-6">
          {f.status === "supported" && <Button className={sm} variant="primary" disabled={busy || blocked} onClick={onApprove}>Approve</Button>}
          {unsupported && <Button className={sm} variant="primary" disabled={busy || blocked} onClick={() => onSave(current)}>Confirm as written</Button>}
          <Button className={sm} disabled={busy} onClick={startEdit}>{f.status === "missing" ? "Fill in" : "Edit"}</Button>
          {f.status !== "missing" && !confirmReject && <Button className={sm} variant="quiet" disabled={busy} onClick={() => setConfirmReject(true)}>Reject</Button>}
          {confirmReject && (
            <>
              <span className="text-small text-ink-soft">Remove this value and its evidence?</span>
              <Button className={sm} disabled={busy} onClick={() => { setConfirmReject(false); onReject(); }}>Reject value</Button>
              <Button className={sm} variant="quiet" onClick={() => setConfirmReject(false)}>Keep</Button>
            </>
          )}
          {blocked && (f.status === "supported" || unsupported) && <span className="text-micro text-ink-soft">Acknowledge the red flag before approving.</span>}
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
    <section aria-label="Not known or unverified" className="flex flex-col gap-1 border-t border-rule px-6 py-3 text-small">
      {missing.length > 0 && <p className="text-ink-soft"><span className="font-medium">Not known:</span> {join(missing)}</p>}
      {pencil.length > 0 && <p className="text-graphite"><span className="font-medium">Unverified, pencil only:</span> {join(pencil)}</p>}
    </section>
  );
}

function Provenance({ s }: { s: IntakeSession }) {
  const calls = s.summary?.modelCalls ?? [];
  if (!calls.length) return null;
  const amd = calls.some((c) => c.provider === "amd-tokenfactory");
  const model = calls.find((c) => c.provider === (amd ? "amd-tokenfactory" : "mock"))?.model ?? "";
  return (
    <footer className="mt-2 flex flex-col gap-0.5 border-t border-rule px-6 py-4 text-micro text-ink-soft">
      <p>
        <span className="font-medium">{amd ? "Gemma · AMD Instinct" : "Mock model, not AMD"}</span> ({model}).{" "}
        {calls.map((c, i) => (
          <span key={i}>{i > 0 && ", "}{STEP_LABEL[c.step] ?? c.step} {c.latencyMs} ms{c.ok ? "" : " (failed)"}</span>
        ))}
        . Generated {clock(s.summary!.generatedAt)}.
      </p>
      <p>Decision support. Research prototype. Clinician confirms.</p>
    </footer>
  );
}

function ActionBar({ busy, canAct, closed, blocked, supportedCount, error, audit, open, onToggle, onApproveAll, onTakeover }: {
  busy: boolean; canAct: boolean; closed: boolean; blocked: boolean; supportedCount: number; error: string | null; audit: AuditEvent[];
  open: boolean; onToggle: () => void; onApproveAll: () => void; onTakeover: (reason: string) => void;
}) {
  const [taking, setTaking] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="shrink-0 border-t border-rule bg-sheet">
      {open && (
        <div id="audit" className="max-h-56 overflow-y-auto border-b border-rule px-6 py-3">
          <h2 className="pb-1 font-sans text-small font-medium">Audit trail</h2>
          <table className="w-full text-small">
            <tbody>
              {audit.map((e) => (
                <tr key={e.id} className="align-baseline">
                  <td className="whitespace-nowrap pr-3 text-ink-soft">{clock(e.at)}</td>
                  <td className="whitespace-nowrap pr-3 text-ink-soft">{e.actorId ?? e.actor}</td>
                  <td>{auditLine(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p role="alert" className="px-6 pt-2 text-small text-signal">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        {taking ? (
          <form className="flex flex-1 flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); onTakeover(reason.trim()); setTaking(false); }}>
            <label htmlFor="takeover-reason" className="text-small text-ink-soft">Reason (optional)</label>
            <input id="takeover-reason" autoFocus value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className="h-9 min-w-48 flex-1 rounded-control border border-rule-strong bg-sheet px-3 text-body" />
            <Button type="submit" variant="primary" disabled={busy}>Take over</Button>
            <Button onClick={() => setTaking(false)}>Cancel</Button>
          </form>
        ) : (
          <>
            <Button variant="primary" disabled={busy || !canAct || supportedCount === 0 || blocked} onClick={onApproveAll}>
              Approve supported fields{supportedCount > 0 ? ` (${supportedCount})` : ""}
            </Button>
            <Button disabled={busy || closed} onClick={() => setTaking(true)}>Take over intake</Button>
            {blocked && <span className="text-small text-ink-soft">Acknowledge the red flag first.</span>}
          </>
        )}
        <Button variant="quiet" className="ml-auto" aria-expanded={open} aria-controls="audit" onClick={onToggle}>
          {open ? "Hide audit trail" : "Audit trail"}
        </Button>
      </div>
    </div>
  );
}
