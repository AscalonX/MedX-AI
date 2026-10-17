"use client";
import { useRef, useState } from "react";
import type { AuditEvent, IntakeSession, Lang, MedAlert, MedicationOrder, MedicationOrderReq, SubmitOrderReq } from "@medx/shared";
import { Badge, Button, Card, CardHeader, Field, Icon } from "@/components/ui";
import { Notice, noDash, statusBadge } from "../../../_bits";
import { fixtureMedication, fixtureMedStatus } from "../../../_fixture";
import { RULE_COUNTS, asSession, call, clockOf, tr } from "../../../_lib";

const EMPTY = { drugText: "", dose: "", route: "oral", frequency: "", duration: "" };
type Apply = (s: IntakeSession, fx: boolean) => void;

export function Meds({ id, session, lang, reviewer, apply, readOnly, audit }: {
  readOnly: boolean; audit: AuditEvent[]; id: string; session: IntakeSession | null; lang: Lang; reviewer: string; apply: Apply }) {
  const [f, setF] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [errs, setErrs] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
      setF(EMPTY); setEditing(null);
    } catch (x) { setFormErr((x as Error).message); }
    finally { setBusy(false); }
  }

  const mutate = async (orderId: string, action: "submit" | "cancel", body: SubmitOrderReq | { orderedBy: string }) => {
    if (!session) return;
    setBusy(true); setErr(null);
    try {
      const to = action === "submit" ? "submitted" : "cancelled";
      const r = await call<unknown>(`/api/sessions/${id}/orders/medications/${orderId}/${action}`, body, () => fixtureMedStatus(session, orderId, (m) => ({ status: to, overrides: action === "submit" ? (body as SubmitOrderReq).overrides.map((o) => ({ ...o, by: reviewer, at: new Date().toISOString() })) : m.overrides })));
      apply(asSession(r.data), r.fixture);
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  const edit = (m: MedicationOrder) => {
    setEditing(m.id); setErrs({}); setFormErr(null);
    setF({ drugText: m.drugText, dose: m.dose, route: m.route, frequency: m.frequency, duration: m.duration ?? "" });
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); formRef.current?.querySelector("input")?.focus(); }, 50);
  };
  const editingOrder = meds.find((m) => m.id === editing);
  return (
    <Card>
      <CardHeader title={tr("medTitle", lang)} />
      {!readOnly && <form ref={formRef} onSubmit={check} noValidate className="space-y-3">
        {editingOrder?.status === "returned" && editingOrder.pharmacist && (
          <p className="rounded-xl bg-warn-tint px-3 py-2 text-body text-warn"><b>{tr("pharmacistNote", lang)}:</b> {editingOrder.pharmacist.note || "-"} <span className="text-small">({editingOrder.pharmacist.by})</span><br /><span className="text-small">{tr("returnedNote", lang)}</span></p>
        )}
        <p className="text-small font-semibold text-ink-soft">{editing ? tr("editRx", lang) : tr("newRx", lang)}</p>
        <Field label={tr("drug", lang)} value={f.drugText} error={errs.drugText} onChange={set("drugText")} autoComplete="off" />
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("dose", lang)} value={f.dose} error={errs.dose} onChange={set("dose")} placeholder="500 mg" autoComplete="off" />
          <Field label={tr("route", lang)} value={f.route} error={errs.route} onChange={set("route")} autoComplete="off" />
          <Field label={tr("frequency", lang)} value={f.frequency} error={errs.frequency} onChange={set("frequency")} placeholder="every 6 hours" autoComplete="off" />
          <Field label={tr("duration", lang)} value={f.duration} onChange={set("duration")} placeholder="5 days" autoComplete="off" />
        </div>
        {formErr && <Notice>{formErr}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={busy} icon={<Icon name="pill" size={16} />}>{busy ? tr("checking", lang) : editing ? tr("update", lang) : tr("check", lang)}</Button>
          {editing && <Button onClick={() => { setEditing(null); setF(EMPTY); }}>{tr("cancelPick", lang)}</Button>}
        </div>
      </form>}

      {meds.length > 0 && (
        <ul className="mt-6 space-y-4">
          {meds.map((m) => <OrderCard key={`${m.id}-${m.at}-${m.status}`} m={m} lang={lang} busy={busy} err={err} audit={audit} readOnly={readOnly} onEdit={() => edit(m)}
            onSubmit={(overrides) => mutate(m.id, "submit", { orderedBy: reviewer, overrides })} onCancel={() => mutate(m.id, "cancel", { orderedBy: reviewer })} />)}
        </ul>
      )}

      <p className="mt-5 border-t border-rule/70 pt-3 text-small text-ink-soft">{tr("footer", lang, { drugs: RULE_COUNTS.drugs, ix: RULE_COUNTS.interactions })}</p>
    </Card>
  );
}

function OrderCard({ m, lang, busy, err, readOnly, audit, onEdit, onSubmit, onCancel }: {
  readOnly: boolean; audit: AuditEvent[];
  m: MedicationOrder; lang: Lang; busy: boolean; err: string | null; onEdit: () => void; onSubmit: (o: { alertId: string; reason: string }[]) => void; onCancel: () => void;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries(m.overrides.map((o) => [o.alertId, o.reason])));
  const high = m.checks.filter((a) => a.severity === "high");
  const missing = high.filter((a) => ((reasons[a.id] ?? "").match(/\p{L}/gu)?.length ?? 0) < 5);
  const editable = !readOnly && m.status === "draft";
    const done = m.status === "cancelled";
  return (
    <li className={`rounded-2xl border border-rule bg-paper p-4 ${done ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lead font-bold text-ink">{m.drugText}{m.generic && m.generic.toLowerCase() !== m.drugText.toLowerCase() ? ` (${m.generic})` : ""}</h3>
        {statusBadge(m.status, lang)}
      </div>
      <p className="text-body text-ink-soft">{[m.dose, m.route, m.frequency, m.duration].filter(Boolean).join(" · ")}</p>

      {m.status === "returned" && m.pharmacist && (
        <p className="mt-2 rounded-xl bg-warn-tint px-3 py-2 text-body text-warn"><b>{tr("pharmacistNote", lang)}:</b> {m.pharmacist.note || "-"} <span className="text-small">({m.pharmacist.by})</span></p>
      )}

      <Timeline m={m} audit={audit} lang={lang} />

      <section className="mt-3" aria-label={tr("checksTitle", lang)}>
        <h4 className="text-small font-bold text-ink">{tr("checksTitle", lang)}</h4>
        {m.checks.length === 0 ? <p className="text-small text-ink-soft">{tr("noChecks", lang)}</p> : (
          <ul className="mt-2 space-y-2">
            {m.checks.map((a) => (
              <AlertCard key={a.id} a={a} lang={lang}>
                {a.severity === "high" && editable && (
                  <Field label={tr("overrideReason", lang)} value={reasons[a.id] ?? ""} maxLength={300} onChange={(e) => setReasons((r) => ({ ...r, [a.id]: e.target.value }))} />
                )}
                {a.severity === "high" && !editable && m.overrides.find((o) => o.alertId === a.id) && (
                  <p className="text-small text-ink-soft">{tr("overrideReason", lang)}: <b className="text-ink">{m.overrides.find((o) => o.alertId === a.id)!.reason}</b></p>
                )}
              </AlertCard>
            ))}
          </ul>
        )}
      </section>

      {err && editable && <div className="mt-3"><Notice>{err}</Notice></div>}
      {editable && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={busy || missing.length > 0} aria-describedby={missing.length ? `why-${m.id}` : undefined} icon={<Icon name="circle-check" size={16} />}
            onClick={() => onSubmit(high.map((a) => ({ alertId: a.id, reason: reasons[a.id]!.trim() })))}>
            {busy ? tr("submitting", lang) : tr("submit", lang)}
          </Button>
          <Button onClick={onEdit}>{tr("edit", lang)}</Button>
          <CancelBtn busy={busy} lang={lang} onCancel={onCancel} />
          {missing.length > 0 && <span id={`why-${m.id}`} className="basis-full text-small font-semibold text-warn">{tr("submitBlocked", lang)}</span>}
        </div>
      )}
      {!readOnly && m.status === "returned" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" icon={<Icon name="pencil" size={16} />} onClick={onEdit}>{tr("editResubmit", lang)}</Button>
          <CancelBtn busy={busy} lang={lang} onCancel={onCancel} />
        </div>
      )}
      {!readOnly && m.status === "submitted" && <div className="mt-3"><CancelBtn busy={busy} lang={lang} onCancel={onCancel} /></div>}
    </li>
  );
}

function AlertCard({ a, lang, children }: { a: MedAlert; lang: Lang; children?: React.ReactNode }) {
  const high = a.severity === "high";
  const unchecked = /MR-DOSE-UNCHECKED|MR-ALLERGY-UNKNOWN/.test(a.ruleId);
  return (
    <li className={`rounded-xl p-3 ${unchecked ? "border-2 border-warn bg-warn-tint" : high ? "bg-signal-tint ring-1 ring-signal/60" : "border border-dashed border-warn/60 bg-warn-tint"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={high ? "signal" : "pencil"} icon={<Icon name="triangle-alert" size={12} />}>{high ? tr("high", lang) : tr("moderate", lang)}</Badge>
        <span className="text-micro font-semibold text-ink-soft">{unchecked ? tr("unchecked", lang) : a.kind.replace(/_/g, " ")}</span>
      </div>
      <p className="mt-1 text-body font-semibold text-ink">{noDash(a.message[lang])}</p>
      <p className="text-small text-ink-soft">{noDash(a.action[lang])}</p>
      {a.evidence.map((e, i) => (
        <p key={i} className="mt-1.5 flex flex-wrap items-center gap-2 text-small text-ink">
          <Badge tone="ocean" icon={<Icon name="quote" size={12} />}>{tr("patientsWords", lang)}</Badge>
          <q className="font-semibold">{e.quote}</q>
        </p>
      ))}
      {children && <div className="mt-2">{children}</div>}
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

/** Order history from the audit trail: submitted / returned / resubmitted / verified / cancelled, in time order. */
function Timeline({ m, audit, lang }: { m: MedicationOrder; audit: AuditEvent[]; lang: Lang }) {
  const mine = audit.filter((e) => (e.payload as { orderId?: string }).orderId === m.id).sort((a, b) => a.at.localeCompare(b.at));
  let returned = false;
  const rows: { at: string; text: string; note?: string }[] = [];
  for (const e of mine) {
    const p = e.payload as { action?: string; by?: string; note?: string; reason?: string };
    if (e.type === "order_submitted") { rows.push({ at: e.at, text: `${tr(returned ? "tlResubmitted" : "tlSubmitted", lang)} ${e.actorId ?? m.orderedBy}` }); returned = false; }
    else if (e.type === "order_pharmacy_action") { if (p.action === "return") returned = true; rows.push({ at: e.at, text: `${tr(p.action === "return" ? "tlReturned" : "tlVerified", lang)} ${p.by ?? e.actorId ?? ""}`, note: p.note }); }
    else if (e.type === "order_cancelled" || p.action === "cancel") rows.push({ at: e.at, text: `${tr("tlCancelled", lang)} ${e.actorId ?? ""}`, note: p.reason });
  }
  if (rows.length === 0) return null;
  return (
    <ol className="mt-3 space-y-1 border-l-2 border-rule pl-3 text-small text-ink-soft" aria-label={tr("tlTitle", lang)}>
      {rows.map((r, i) => <li key={i}><b className="text-ink">{r.text}</b>{r.note ? `: ${r.note}` : ""}, {clockOf(r.at, lang)}</li>)}
    </ol>
  );
}
