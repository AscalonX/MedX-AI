"use client";
import Link from "next/link";
import { useState } from "react";
import type { Lang, MedicationOrder } from "@medx/shared";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Icon, LangMorph } from "@/components/ui";
import { KIND_LABEL, clock, openHighChecks, orderBlock, orderTitle, overrideOf, ordersOf, pendingOrders, waited } from "./_lib";
import { usePharmacy } from "./_shell";

const sm = "h-8! px-3! text-small!";
// English first: th/it fall back to English wording for this new section.
const STATUS: Record<MedicationOrder["status"], { label: string; tone: "outline" | "ocean" | "teal" | "pencil" }> = {
  draft: { label: "Draft", tone: "outline" },
  submitted: { label: "Awaiting pharmacist", tone: "ocean" },
  verified: { label: "Verified", tone: "teal" },
  returned: { label: "Returned to prescriber", tone: "pencil" },
  cancelled: { label: "Cancelled", tone: "outline" },
};

function OrderCard({ o, lang, busy, onAction }: { o: MedicationOrder; lang: Lang; busy: boolean; onAction: (a: "verify" | "return", note?: string) => Promise<boolean> }) {
  const [form, setForm] = useState(false);
  const [note, setNote] = useState("");
  const block = orderBlock(o);
  const st = STATUS[o.status];
  const open = o.status === "submitted";
  const hasHigh = o.checks.some((c) => c.severity === "high");
  return (
    <li className="rounded-2xl border border-rule/70 bg-sheet p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-ocean-tint text-ocean"><Icon name="pill" /></span>
        <div className="min-w-0 flex-1 basis-60">
          <h3 className="text-lead font-bold">{orderTitle(o)}</h3>
          <p className="text-small text-ink-soft">{o.route} · {o.frequency}{o.duration ? ` · ${o.duration}` : ""}{o.drugClass ? ` · ${o.drugClass.replace(/_/g, " ")}` : ""}</p>
          <p className="text-small text-ink-soft">Prescribed by {o.orderedBy}, {clock(o.at)}</p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>

      {o.checks.length === 0 ? (
        <p className="mt-3 text-small text-ink-soft">No rule alerts for this order. This is not a complete prescribing check.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {o.checks.map((c) => {
            const ov = overrideOf(o, c.id);
            const high = c.severity === "high" && !ov;
            return (
              <li key={c.id} className={`rounded-xl p-3 ${high ? "border border-signal/50 bg-signal-tint ring-1 ring-signal/20" : c.severity === "high" ? "border border-warn/30 bg-warn-tint" : "border border-rule/70 bg-paper"}`}>
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={c.severity === "high" ? (high ? "signalOutline" : "pencil") : "outline"} icon={<Icon name="triangle-alert" size={14} />}>{c.severity === "high" ? "High" : "Moderate"}</Badge>
                  <span className="font-bold"><LangMorph text={KIND_LABEL[c.kind]} lang={lang} /></span>
                  <span className="text-micro text-ink-soft">{c.ruleId}</span>
                </p>
                <p className="mt-1 text-body"><LangMorph text={c.message} lang={lang} /></p>
                <p className="text-small text-ink-soft"><span className="font-semibold">Check: </span><LangMorph text={c.action} lang={lang} /></p>
                {c.source && <p className="text-micro text-graphite">{c.source}</p>}
                {ov ? (
                  <p className="mt-2 rounded-lg bg-sheet px-3 py-2 text-small"><span className="font-bold">Prescriber override: </span>{ov.reason} <span className="text-ink-soft">({ov.by}, {clock(ov.at)})</span></p>
                ) : c.severity === "high" ? (
                  <p className="mt-2 text-small font-semibold text-signal">No prescriber override recorded.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {open && !form && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" className={sm} disabled={busy || !!block} aria-describedby={`ob-${o.id}`} onClick={() => onAction("verify")} icon={<Icon name="circle-check" size={16} />}>Verify</Button>
          <Button className={sm} disabled={busy} onClick={() => { setForm(true); setNote(""); }}>Return to prescriber</Button>
          {block && <p id={`ob-${o.id}`} role="status" className="basis-full text-small font-semibold text-warn">Verify is blocked: {block}</p>}
          {!block && hasHigh && <p id={`ob-${o.id}`} className="basis-full text-small text-ink-soft">Every high alert has a documented prescriber override. You are verifying the order and that reasoning.</p>}
        </div>
      )}
      {open && form && (
        <form className="mt-3 flex flex-col gap-2" onSubmit={async (e) => { e.preventDefault(); if (note.trim() && (await onAction("return", note.trim()))) setForm(false); }} onKeyDown={(e) => { if (e.key === "Escape") setForm(false); }}>
          <Field autoFocus required multiline maxLength={500} label="Note to the prescriber (required)" hint="Say what to change or confirm. The order stays on the record." value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className={sm} disabled={busy || !note.trim()}>Return order</Button>
            <Button className={sm} onClick={() => setForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {o.status === "verified" && o.pharmacist && (
        <p role="status" className="mt-3 rounded-xl border border-teal/30 bg-teal-tint p-3 text-small text-ink">
          <span className="flex items-center gap-2 font-bold text-teal"><Icon name="circle-check" size={16} />Order verified</span>
          By {o.pharmacist.by}, {clock(o.pharmacist.at)}. {hasHigh ? "Prescriber override reasons reviewed." : ""} Nothing is dispensed from this screen; the prescriber&apos;s order stands on the record.
        </p>
      )}
      {o.status === "returned" && o.pharmacist && (
        <p role="status" className="mt-3 rounded-xl border border-warn/30 bg-warn-tint p-3 text-small text-ink">
          <span className="font-bold text-warn">Returned to {o.orderedBy}</span> by {o.pharmacist.by}, {clock(o.pharmacist.at)}.{o.pharmacist.note ? <> Note: {o.pharmacist.note}</> : null}
        </p>
      )}
    </li>
  );
}

/** "New prescriptions" card on the session page, above the reconciliation. */
export function PrescriptionsCard({ sessionId, orders, lang, busy, fixture, run }: {
  sessionId: string; orders: MedicationOrder[]; lang: Lang; busy: boolean; fixture: boolean; run: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { submitOrder } = usePharmacy();
  const visible = orders.filter((o) => o.status !== "draft");
  if (visible.length === 0) return null;
  const sorted = [...visible].sort((a, b) => Number(b.status === "submitted") - Number(a.status === "submitted") || Number(openHighChecks(b).length > 0) - Number(openHighChecks(a).length > 0));
  return (
    <Card id="orders" aria-labelledby="h-orders">
      <CardHeader title={<span id="h-orders">New prescriptions</span>} action={<span className="flex items-center gap-2">{fixture && <Badge tone="pencil">Fixture</Badge>}<span className="text-small text-ink-soft">{visible.length}</span></span>} />
      <ul className="flex flex-col gap-3">
        {sorted.map((o) => <OrderCard key={o.id} o={o} lang={lang} busy={busy} onAction={(a, note) => run(() => submitOrder(sessionId, o.id, a, note))} />)}
      </ul>
    </Card>
  );
}

/** Queue of submitted orders across sessions; unhandled high alerts pinned first. */
export function PrescriptionQueue() {
  const { entries, now } = usePharmacy();
  const rows = (entries ?? []).flatMap(({ session, fixture }) => pendingOrders(session).map((o) => ({ session, fixture, o })))
    .sort((a, b) => Number(openHighChecks(b.o).length > 0) - Number(openHighChecks(a.o).length > 0) || a.o.at.localeCompare(b.o.at));
  if (!entries) return <div aria-busy="true" className="flex flex-col gap-3 p-5">{[0, 1].map((i) => <span key={i} className="mx-blank !block !h-14 !w-full !rounded-2xl" />)}</div>;
  if (rows.length === 0) return <EmptyState icon={<Icon name="inbox" />} title="No prescriptions waiting" body="Orders submitted by doctors appear here for verification." />;
  return (
    <ul className="flex flex-col gap-3 p-4 pt-1">
      {rows.map(({ session: s, fixture, o }) => {
        const high = openHighChecks(o).length;
        const mod = o.checks.length - o.checks.filter((c) => c.severity === "high").length;
        const overridden = o.overrides.length;
        return (
          <li key={`${s.id}-${o.id}`}>
            <Link href={`/pharmacy/${s.id}#orders`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-rule/70 bg-sheet p-4 transition-[transform,box-shadow] duration-base ease-pen hover:-translate-y-0.5 hover:shadow-sheet-lifted">
              <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full ${high ? "bg-signal text-on-signal" : "bg-ocean-tint text-ocean"}`}><Icon name={high ? "triangle-alert" : "pill"} /></span>
              <span className="min-w-0 flex-1 basis-56">
                <span className="block text-lead font-bold">{orderTitle(o)} <span className="text-small font-medium text-ink-soft">{o.route} · {o.frequency}</span></span>
                <span className="block text-small text-ink-soft">{s.code} · {o.orderedBy}{fixture ? " · fixture" : ""}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {high > 0 && <Badge tone="signalOutline">{high} high, no override</Badge>}
                {overridden > 0 && <Badge tone="pencil">Prescriber override</Badge>}
                {mod > 0 && <Badge tone="outline">{mod} to check</Badge>}
                {o.checks.length === 0 && <span className="text-small text-ink-soft">No rule alerts</span>}
                <span className="w-16 text-right text-small text-ink-soft">{now ? waited(o.at, now) : ""}</span>
              </span>
              <Icon name="chevron-right" className="text-graphite" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export { ordersOf };
