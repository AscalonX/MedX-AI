"use client";
import { useRef, useState, type ReactNode } from "react";
import type { AuditEvent, IntakeSession, Lang, MedAlert, MedicationOrder, MedicationOrderReq, PickupState, SubmitOrderReq } from "@medx/shared";
import { Badge, Button, Card, CardHeader, Field, Icon } from "@/components/ui";
import { Notice, noDash, statusBadge } from "../../../_bits";
import { fixtureMedication, fixtureMedStatus } from "../../../_fixture";
import { RULE_COUNTS, alternativeNotes, asSession, call, clockOf, drugTextFor, tr } from "../../../_lib";

const EMPTY = { drugText: "", dose: "", route: "oral", frequency: "", duration: "" };
type Apply = (s: IntakeSession, fx: boolean) => void;
/** A prescriber may cancel only these. Verified and dispensed orders are locked (the server refuses too). */
const CANCELLABLE = new Set<MedicationOrder["status"]>(["draft", "returned", "submitted"]);
/** The prescriber acts on these: edit, re-check, submit. */
const PRESCRIBER_OWNED = new Set<MedicationOrder["status"]>(["draft", "returned"]);
const rxLine = (m: Pick<MedicationOrder, "dose" | "route" | "frequency" | "duration">) => [m.dose, m.route, m.frequency, m.duration].filter(Boolean).join(" · ");

export function Meds({ id, session, lang, reviewer, apply, readOnly, audit }: {
  readOnly: boolean; audit: AuditEvent[]; id: string; session: IntakeSession | null; lang: Lang; reviewer: string; apply: Apply }) {
  const [f, setF] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  /** Set when the edit form was opened from an alternative: the option under review and the previous prescription. */
  const [alt, setAlt] = useState<{ generic: string; prev: string } | null>(null);
  const [errs, setErrs] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ orderId: string; msg: string } | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const meds = session?.orders?.medications ?? [];
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function check(ev: React.FormEvent) {
    ev.preventDefault();
    const e: typeof errs = {};
    for (const k of ["drugText", "dose", "route", "frequency"] as const) if (!f[k].trim()) e[k] = tr("required", lang);
    setErrs(e);
    if (Object.keys(e).length || !session) return;
    const req: MedicationOrderReq = { orderedBy: reviewer, orderId: editing ?? undefined, drugText: f.drugText.trim(), dose: f.dose.trim(), route: f.route.trim(), frequency: f.frequency.trim(), duration: f.duration.trim() || undefined };
    setBusy(true); setErr(null); setFormErr(null);
    try {
      const r = await call<unknown>(`/api/sessions/${id}/orders/medications`, req, () => fixtureMedication(session, req));
      apply(asSession(r.data), r.fixture);
      setF(EMPTY); setEditing(null); setAlt(null);
    } catch (x) { setFormErr((x as Error).message); }
    finally { setBusy(false); }
  }

  const stopEdit = () => { setEditing(null); setF(EMPTY); setAlt(null); setErrs({}); setFormErr(null); };
  const mutate = async (orderId: string, action: "submit" | "cancel", body: SubmitOrderReq | { orderedBy: string }) => {
    if (!session) return;
    setBusy(true); setErr(null);
    try {
      const to = action === "submit" ? "submitted" : "cancelled";
      const r = await call<unknown>(`/api/sessions/${id}/orders/medications/${orderId}/${action}`, body, () => fixtureMedStatus(session, orderId, (m) => ({ status: to, overrides: action === "submit" ? (body as SubmitOrderReq).overrides.map((o) => ({ ...o, by: reviewer, at: new Date().toISOString() })) : m.overrides })));
      apply(asSession(r.data), r.fixture);
      if (action === "cancel" && editing === orderId) stopEdit();
    } catch (x) { setErr({ orderId, msg: (x as Error).message }); }
    finally { setBusy(false); }
  };

  /** Open the edit form. With `generic` (an option for review), the drug is swapped and dose / frequency are cleared so the prescriber sets them; nothing is saved until "Update and re-check". */
  const edit = (m: MedicationOrder, generic?: string) => {
    setEditing(m.id); setErrs({}); setFormErr(null);
    setAlt(generic ? { generic, prev: `${m.drugText} · ${rxLine(m)}` } : null);
    setF(generic
      ? { drugText: drugTextFor(generic), dose: "", route: m.route, frequency: "", duration: m.duration ?? "" }
      : { drugText: m.drugText, dose: m.dose, route: m.route, frequency: m.frequency, duration: m.duration ?? "" });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      formRef.current?.querySelector<HTMLInputElement>(generic ? 'input[name="dose"]' : "input")?.focus();
    }, 50);
  };
  const editingOrder = meds.find((m) => m.id === editing);
  return (
    <Card>
      <CardHeader title={tr("medTitle", lang)} />
      <PickupStrip pickup={session?.pickup} meds={meds} lang={lang} />
      {!readOnly && <form ref={formRef} onSubmit={check} noValidate className="space-y-3">
        {editingOrder?.status === "returned" && editingOrder.pharmacist && (
          <p className="rounded-xl bg-warn-tint px-3 py-2 text-body text-warn"><b>{tr("pharmacistNote", lang)}:</b> {editingOrder.pharmacist.note || "-"} <span className="text-small">({editingOrder.pharmacist.by})</span><br /><span className="text-small">{tr("returnedNote", lang)}</span></p>
        )}
        {alt && editing && (
          <div className="rounded-xl border border-dashed border-ocean/60 bg-ocean-tint px-3 py-2 text-small">
            <p className="font-semibold text-ocean">{tr("switchHint", lang, { drug: alt.generic })}</p>
            <p className="text-ink-soft">{tr("previousRx", lang)}: {alt.prev}</p>
          </div>
        )}
        <p className="text-small font-semibold text-ink-soft">{editing ? tr("editRx", lang) : tr("newRx", lang)}</p>
        <Field label={tr("drug", lang)} name="drugText" value={f.drugText} error={errs.drugText} onChange={set("drugText")} autoComplete="off" />
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("dose", lang)} name="dose" value={f.dose} error={errs.dose} onChange={set("dose")} placeholder="500 mg" autoComplete="off" />
          <Field label={tr("route", lang)} name="route" value={f.route} error={errs.route} onChange={set("route")} autoComplete="off" />
          <Field label={tr("frequency", lang)} name="frequency" value={f.frequency} error={errs.frequency} onChange={set("frequency")} placeholder="every 6 hours" autoComplete="off" />
          <Field label={tr("duration", lang)} name="duration" value={f.duration} onChange={set("duration")} placeholder="5 days" autoComplete="off" />
        </div>
        {formErr && <Notice>{formErr}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={busy} icon={<Icon name="pill" size={16} />}>{busy ? tr("checking", lang) : editing ? tr("update", lang) : tr("check", lang)}</Button>
          {editing && <Button onClick={stopEdit}>{tr("cancelPick", lang)}</Button>}
        </div>
      </form>}

      {meds.length > 0 && (
        <ul className="mt-6 space-y-4">
          {meds.map((m) => <OrderCard key={`${m.id}-${m.at}-${m.status}`} m={m} lang={lang} busy={busy} err={err?.orderId === m.id ? err.msg : null} audit={audit} readOnly={readOnly}
            onEdit={(generic) => edit(m, generic)}
            onSubmit={(overrides) => mutate(m.id, "submit", { orderedBy: reviewer, overrides })} onCancel={() => mutate(m.id, "cancel", { orderedBy: reviewer })} />)}
        </ul>
      )}

      <p className="mt-5 border-t border-rule/70 pt-3 text-small text-ink-soft">{tr("footer", lang, { drugs: RULE_COUNTS.drugs, ix: RULE_COUNTS.interactions })}</p>
    </Card>
  );
}

/** Session-level pickup: preparing (some medicine still in pharmacy), ready at a counter, or collected. */
function PickupStrip({ pickup, meds, lang }: { pickup?: PickupState; meds: MedicationOrder[]; lang: Lang }) {
  const active = meds.filter((m) => m.status !== "cancelled");
  const inPharmacy = active.some((m) => m.status === "submitted" || m.status === "verified" || m.status === "dispensed");
  if (!pickup && !inPharmacy) return null;
  const dispensed = active.filter((m) => m.status === "dispensed").length;
  const preparing = <Badge tone="outline" icon={<Icon name="clock" size={12} />}>{tr("pickupPreparing", lang, { n: dispensed, total: active.length })}</Badge>;
  let badge: ReactNode;
  let line: string | null = null;
  // After collection, a newer order still in pharmacy is shown too rather than hidden behind "collected".
  const stillInPharmacy = active.some((m) => m.status === "submitted" || m.status === "verified");
  if (pickup?.status === "collected") {
    badge = <Badge tone="teal" icon={<Icon name="circle-check" size={12} />}>{tr("pickupCollected", lang)}</Badge>;
    if (pickup.collectedAt) line = tr("pickupHandedBy", lang, { who: pickup.collectedBy ?? "-", time: clockOf(pickup.collectedAt, lang) });
  } else if (pickup?.status === "ready") {
    badge = <Badge tone="ocean" icon={<Icon name="bell" size={12} />}>{pickup.counter ? tr("pickupReady", lang, { counter: pickup.counter }) : tr("pickupReadyNoCounter", lang)}</Badge>;
    line = tr("pickupCalledBy", lang, { who: pickup.calledBy, time: clockOf(pickup.calledAt, lang) });
  } else {
    badge = preparing;
  }
  return (
    <section aria-label={tr("pickupTitle", lang)} className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl bg-paper px-4 py-3">
      <h3 className="text-small font-bold text-ink">{tr("pickupTitle", lang)}</h3>
      {badge}
      {line && <span className="text-small text-ink-soft">{line}</span>}
      {pickup?.status === "collected" && stillInPharmacy && preparing}
    </section>
  );
}

function OrderCard({ m, lang, busy, err, readOnly, audit, onEdit, onSubmit, onCancel }: {
  readOnly: boolean; audit: AuditEvent[];
  m: MedicationOrder; lang: Lang; busy: boolean; err: string | null; onEdit: (generic?: string) => void; onSubmit: (o: { alertId: string; reason: string }[]) => void; onCancel: () => void;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries(m.overrides.map((o) => [o.alertId, o.reason])));
  const high = m.checks.filter((a) => a.severity === "high");
  const missing = high.filter((a) => ((reasons[a.id] ?? "").match(/\p{L}/gu)?.length ?? 0) < 5);
  const editable = !readOnly && m.status === "draft";
  const canEdit = !readOnly && PRESCRIBER_OWNED.has(m.status);
  const done = m.status === "cancelled";
  // Pharmacist 1's report is stored only on a return.
  const report = m.status === "returned" ? m.pharmacist?.report : undefined;
  const flaggedIds = new Set(report?.alertIds ?? []);
  const flagged = m.checks.filter((a) => flaggedIds.has(a.id));
  const flaggedGone = flaggedIds.size - flagged.length;
  const suggested = (report?.suggestedGenerics ?? []).filter((g) => g !== m.generic);
  const cancel = !readOnly && CANCELLABLE.has(m.status) ? <CancelBtn busy={busy} lang={lang} onCancel={onCancel} /> : null;
  return (
    <li className={`rounded-2xl border border-rule bg-paper p-4 ${done ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lead font-bold text-ink">{m.drugText}{m.generic && m.generic.toLowerCase() !== m.drugText.toLowerCase() ? ` (${m.generic})` : ""}</h3>
        {statusBadge(m.status, lang)}
      </div>
      <p className="text-body text-ink-soft">{rxLine(m)}</p>
      {m.status === "submitted" && m.recheck && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-warn/60 bg-warn-tint px-3 py-2 text-small font-semibold text-warn">
          <Icon name="triangle-alert" size={16} className="mt-px shrink-0" />{tr("recheckNote", lang)}
        </p>
      )}

      {m.status === "returned" && m.pharmacist && (
        <section aria-label={tr("pharmacistReport", lang)} className="mt-3 space-y-2 rounded-xl border border-dashed border-warn/60 bg-warn-tint px-3 py-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h4 className="text-small font-bold text-warn">{tr("pharmacistReport", lang)}</h4>
            <span className="text-small text-warn">{tr("reportBy", lang, { who: m.pharmacist.by, time: clockOf(m.pharmacist.at, lang) })}</span>
          </div>
          <p className="text-body text-ink"><b>{tr("pharmacistNote", lang)}:</b> {m.pharmacist.note || "-"}</p>
          {flagged.length > 0 && (
            <div>
              <p className="text-small font-semibold text-ink">{tr("flaggedChecks", lang)}</p>
              <ul className="mt-1 space-y-1">
                {flagged.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-small text-ink"><SeverityBadge a={a} lang={lang} /> {noDash(a.message[lang])}</li>
                ))}
              </ul>
            </div>
          )}
          {flaggedGone > 0 && <p className="text-small text-ink-soft">{tr("flaggedGone", lang, { n: flaggedGone })}</p>}
          {suggested.length > 0 && (
            <AltOptions title={tr("suggestedAlts", lang)} note={tr("suggestedAltsNote", lang)} generics={suggested} lang={lang} busy={busy} onPick={canEdit ? onEdit : undefined} />
          )}
        </section>
      )}

      {(m.status === "verified" || m.status === "dispensed") && (m.pharmacist?.action === "verify" || m.dispense) && (
        <div className="mt-3 space-y-0.5 rounded-xl bg-teal-tint px-3 py-2 text-small text-teal">
          {m.pharmacist?.action === "verify" && <p className="flex items-center gap-1.5"><Icon name="check" size={14} /> {tr("verifiedLine", lang, { who: m.pharmacist.by, time: clockOf(m.pharmacist.at, lang) })}</p>}
          {m.status === "dispensed" && m.dispense && (
            <>
              <p className="flex items-center gap-1.5 font-semibold"><Icon name="circle-check" size={14} /> {tr("dispensedLine", lang, { who: m.dispense.by, time: clockOf(m.dispense.at, lang) })}</p>
              {Object.values(m.dispense.checklist).every(Boolean) && <p className="text-micro">{tr("dispenseChecked", lang)}</p>}
              {m.dispense.note && <p className="text-ink">{tr("note", lang)}: {m.dispense.note}</p>}
            </>
          )}
        </div>
      )}

      <Timeline m={m} audit={audit} lang={lang} />

      <section className="mt-3" aria-label={tr("checksTitle", lang)}>
        <h4 className="text-small font-bold text-ink">{tr("checksTitle", lang)}</h4>
        {m.checks.length === 0 ? <p className="text-small text-ink-soft">{tr("noChecks", lang)}</p> : (
          <ul className="mt-2 space-y-2">
            {m.checks.map((a) => (
              <AlertCard key={a.id} a={a} lang={lang} flagged={flaggedIds.has(a.id)}>
                {a.severity === "high" && editable && (
                  <Field label={tr("overrideReason", lang)} value={reasons[a.id] ?? ""} maxLength={300} onChange={(e) => setReasons((r) => ({ ...r, [a.id]: e.target.value }))} />
                )}
                {a.severity === "high" && !editable && m.overrides.find((o) => o.alertId === a.id) && (
                  <p className="text-small text-ink-soft">{tr("overrideReason", lang)}: <b className="text-ink">{m.overrides.find((o) => o.alertId === a.id)!.reason}</b></p>
                )}
                {PRESCRIBER_OWNED.has(m.status) && (a.alternatives?.length ?? 0) > 0 && (
                  <AltOptions title={tr("optionsToReview", lang)} note={tr("optionsNote", lang)} generics={a.alternatives!} lang={lang} busy={busy} onPick={canEdit ? onEdit : undefined}>
                    {alternativeNotes(a.kind, m.drugClass).filter((e) => e.consider.some((g) => a.alternatives!.includes(g))).map((e) => (
                      <div key={e.id} className="mt-2 text-micro text-ink-soft">
                        <p>{noDash(e.note[lang])}</p>
                        <details className="mt-0.5">
                          <summary className="cursor-pointer font-semibold text-ocean">{tr("altSource", lang)}</summary>
                          <p className="mt-0.5">{e.source}</p>
                        </details>
                      </div>
                    ))}
                  </AltOptions>
                )}
              </AlertCard>
            ))}
          </ul>
        )}
      </section>

      {err && <div className="mt-3"><Notice>{err}</Notice></div>}
      {editable && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={busy || missing.length > 0} aria-describedby={missing.length ? `why-${m.id}` : undefined} icon={<Icon name="circle-check" size={16} />}
            onClick={() => onSubmit(high.map((a) => ({ alertId: a.id, reason: reasons[a.id]!.trim() })))}>
            {busy ? tr("submitting", lang) : tr("submit", lang)}
          </Button>
          <Button onClick={() => onEdit()}>{tr("edit", lang)}</Button>
          {cancel}
          {missing.length > 0 && <span id={`why-${m.id}`} className="basis-full text-small font-semibold text-warn">{tr("submitBlocked", lang)}</span>}
        </div>
      )}
      {canEdit && m.status === "returned" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" icon={<Icon name="pencil" size={16} />} onClick={() => onEdit()}>{tr("editResubmit", lang)}</Button>
          {cancel}
        </div>
      )}
      {m.status === "submitted" && cancel && <div className="mt-3">{cancel}</div>}
      {!readOnly && (m.status === "verified" || m.status === "dispensed") && <p className="mt-3 text-micro text-ink-soft">{tr("noCancelLocked", lang)}</p>}
    </li>
  );
}

const SeverityBadge = ({ a, lang }: { a: MedAlert; lang: Lang }) => (
  <Badge tone={a.severity === "high" ? "signal" : "pencil"} icon={<Icon name="triangle-alert" size={12} />}>{a.severity === "high" ? tr("high", lang) : tr("moderate", lang)}</Badge>
);

/** Options for prescriber review. Never applied automatically: picking one only opens the edit form. */
function AltOptions({ title, note, generics, lang, busy, onPick, children }: {
  title: string; note: string; generics: string[]; lang: Lang; busy: boolean; onPick?: (generic: string) => void; children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ocean/60 bg-sheet p-3">
      <p className="text-small font-bold text-ink">{title}</p>
      <p className="text-micro text-ink-soft">{note}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {generics.map((g) => (
          <li key={g}>
            {onPick
              ? <Button variant="secondary" disabled={busy} icon={<Icon name="pencil" size={16} />} onClick={() => onPick(g)}>{tr("useAlt", lang, { drug: g })}</Button>
              : <Badge tone="outline" icon={<Icon name="pill" size={12} />}>{g}</Badge>}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

function AlertCard({ a, lang, flagged, children }: { a: MedAlert; lang: Lang; flagged?: boolean; children?: ReactNode }) {
  const high = a.severity === "high";
  const unchecked = /MR-DOSE-UNCHECKED|MR-ALLERGY-UNKNOWN/.test(a.ruleId);
  return (
    <li className={`rounded-xl p-3 ${unchecked ? "border-2 border-warn bg-warn-tint" : high ? "bg-signal-tint ring-1 ring-signal/60" : "border border-dashed border-warn/60 bg-warn-tint"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge a={a} lang={lang} />
        <span className="text-micro font-semibold text-ink-soft">{unchecked ? tr("unchecked", lang) : a.kind.replace(/_/g, " ")}</span>
        {flagged && <Badge tone="ink" icon={<Icon name="user" size={12} />}>{tr("flaggedBadge", lang)}</Badge>}
      </div>
      <p className="mt-1 text-body font-semibold text-ink">{noDash(a.message[lang])}</p>
      <p className="text-small text-ink-soft">{noDash(a.action[lang])}</p>
      {a.evidence.map((e, i) => (
        <p key={i} className="mt-1.5 flex flex-wrap items-center gap-2 text-small text-ink">
          <Badge tone="ocean" icon={<Icon name="quote" size={12} />}>{tr("patientsWords", lang)}</Badge>
          <q className="font-semibold">{e.quote}</q>
        </p>
      ))}
      {children && <div className="mt-2 space-y-2">{children}</div>}
    </li>
  );
}

/** Two-step cancel: first click asks, second confirms. */
function CancelBtn({ busy, lang, onCancel }: { busy: boolean; lang: Lang; onCancel: () => void }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className="inline-flex gap-2">
      <Button variant="secondary" disabled={busy} onClick={onCancel}>{tr("confirmCancel", lang)}</Button>
      <Button onClick={() => setAsk(false)}>{tr("keep", lang)}</Button>
    </span>
  ) : <Button variant="quiet" disabled={busy} onClick={() => setAsk(true)}>{tr("cancelOrder", lang)}</Button>;
}

type AuditPayload = {
  orderId?: string; orderIds?: unknown; action?: string; by?: string; note?: string; reason?: string;
  recall?: boolean; counter?: string; pickupReset?: boolean; report?: { suggestedGenerics?: string[] }; ruleIds?: unknown;
};
/** Order history from the audit trail: submitted / returned / resubmitted / verified / dispensed / pickup / cancelled, in time order. */
function Timeline({ m, audit, lang }: { m: MedicationOrder; audit: AuditEvent[]; lang: Lang }) {
  const mine = audit
    .filter((e) => { const p = e.payload as AuditPayload; return p.orderId === m.id || (Array.isArray(p.orderIds) && p.orderIds.includes(m.id)); })
    .sort((a, b) => a.at.localeCompare(b.at));
  let returned = false;
  const rows: { at: string; text: string; note?: string }[] = [];
  for (const e of mine) {
    const p = e.payload as AuditPayload;
    if (e.type === "order_submitted") {
      rows.push({ at: e.at, text: `${tr(returned ? "tlResubmitted" : "tlSubmitted", lang)} ${e.actorId ?? m.orderedBy}`, note: p.pickupReset ? tr("tlPickupReset", lang) : undefined });
      returned = false;
    } else if (e.type === "order_pharmacy_action") {
      const isReturn = p.action === "return";
      if (isReturn) returned = true;
      const sug = isReturn ? (p.report?.suggestedGenerics ?? []) : [];
      const note = [p.note, sug.length ? tr("tlSuggested", lang, { drugs: sug.join(", ") }) : ""].filter(Boolean).join("; ");
      rows.push({ at: e.at, text: `${tr(isReturn ? "tlReturned" : "tlVerified", lang)} ${p.by ?? e.actorId ?? ""}`, note: note || undefined });
    } else if (e.type === "order_dispensed") {
      rows.push({ at: e.at, text: `${tr("tlDispensed", lang)} ${p.by ?? e.actorId ?? ""}`, note: p.note });
    } else if (e.type === "pickup_called") {
      rows.push({ at: e.at, text: `${tr(p.recall ? "tlPickupRecalled" : "tlPickupCalled", lang)} ${e.actorId ?? ""}`, note: p.counter ? tr("tlCounter", lang, { counter: p.counter }) : undefined });
    } else if (e.type === "pickup_collected") {
      rows.push({ at: e.at, text: `${tr("tlPickupCollected", lang)} ${e.actorId ?? ""}` });
    } else if (e.type === "order_recheck") {
      const rules = Array.isArray(p.ruleIds) ? p.ruleIds.filter((r): r is string => typeof r === "string") : [];
      rows.push({ at: e.at, text: tr("tlRecheck", lang), note: rules.join(", ") || undefined });
    } else if (e.type === "order_cancelled" || p.action === "cancel") {
      rows.push({ at: e.at, text: `${tr("tlCancelled", lang)} ${e.actorId ?? ""}`, note: p.reason });
    }
  }
  if (rows.length === 0) return null;
  return (
    <ol className="mt-3 space-y-1 border-l-2 border-rule pl-3 text-small text-ink-soft" aria-label={tr("tlTitle", lang)}>
      {rows.map((r, i) => <li key={i}><b className="text-ink">{r.text}</b>{r.note ? `: ${r.note}` : ""}, {clockOf(r.at, lang)}</li>)}
    </ol>
  );
}
