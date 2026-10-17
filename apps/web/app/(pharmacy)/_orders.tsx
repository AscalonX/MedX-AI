"use client";
import Link from "next/link";
import { useState } from "react";
import type { Lang, Localized, MedicationOrder } from "@medx/shared";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Icon, LangMorph } from "@/components/ui";
import { U, KIND_LABEL, L, clock, openHighChecks, orderTitle, overrideOf, ordersOf, pendingOrders, waited } from "./_lib";
import { usePharmacy } from "./_shell";

const sm = "h-8! px-3! text-small!";
const ST_TONE: Record<MedicationOrder["status"], "outline" | "ocean" | "teal" | "pencil"> = { draft: "outline", submitted: "ocean", verified: "teal", returned: "pencil", cancelled: "outline" };
const OL = {
  status: {
    draft: L("ฉบับร่าง", "Bozza", "Draft"),
    submitted: L("รอเภสัชกร", "In attesa del farmacista", "Awaiting pharmacist"),
    verified: L("ตรวจสอบแล้ว", "Verificato", "Verified"),
    returned: L("ส่งกลับแพทย์", "Restituito al prescrittore", "Returned to prescriber"),
    cancelled: L("ยกเลิก", "Annullato", "Cancelled"),
  } as Record<MedicationOrder["status"], Localized>,
  prescribedBy: L("สั่งโดย", "Prescritto da", "Prescribed by"),
  noAlerts: L("ไม่มีการแจ้งเตือนจากกฎสำหรับคำสั่งนี้ ไม่ใช่การตรวจการสั่งยาแบบครบถ้วน", "Nessun avviso dalle regole per questo ordine. Non è un controllo completo della prescrizione.", "No rule alerts for this order. This is not a complete prescribing check."),
  high: L("สูง", "Alto", "High"), moderate: L("ปานกลาง", "Moderato", "Moderate"),
  check: L("สิ่งที่ต้องตรวจ", "Da verificare", "Check"),
  override: L("แพทย์ยืนยันดำเนินการต่อ", "Deroga del prescrittore", "Prescriber override"),
  noOverride: L("ไม่มีเหตุผลการยืนยันดำเนินการต่อจากแพทย์", "Nessuna deroga del prescrittore registrata", "No prescriber override recorded"),
  verify: L("ตรวจสอบ", "Verifica", "Verify"),
  returnBtn: L("ส่งกลับแพทย์", "Restituisci al prescrittore", "Return to prescriber"),
  blocked: L("ยังตรวจสอบไม่ได้", "Verifica bloccata", "Verify is blocked"),
  blockHigh: (n: number) => L(`การแจ้งเตือนสูง ${n} รายการไม่มีเหตุผลจากแพทย์ ให้ส่งกลับแพทย์พร้อมหมายเหตุ`, `${n} avvisi alti senza deroga del prescrittore. Restituire l'ordine con una nota.`, `${n} high ${n === 1 ? "alert has" : "alerts have"} no prescriber override. Return the order to the prescriber with a note.`),
  overridesOk: L("การแจ้งเตือนสูงทุกรายการมีเหตุผลจากแพทย์ที่บันทึกไว้ การตรวจสอบคือการยืนยันคำสั่งและเหตุผลนั้น", "Ogni avviso alto ha una deroga documentata. Verificando, confermi l'ordine e quel ragionamento.", "Every high alert has a documented prescriber override. You are verifying the order and that reasoning."),
  noteLabel: L("หมายเหตุถึงแพทย์ (จำเป็น)", "Nota al prescrittore (obbligatoria)", "Note to the prescriber (required)"),
  noteHint: L("บอกสิ่งที่ต้องแก้หรือยืนยัน คำสั่งยังอยู่ในบันทึก", "Indica cosa cambiare o confermare. L'ordine resta nel registro.", "Say what to change or confirm. The order stays on the record."),
  returnOrder: L("ส่งคืนคำสั่ง", "Restituisci ordine", "Return order"),
  verified: L("ตรวจสอบคำสั่งแล้ว", "Ordine verificato", "Order verified"),
  by: L("โดย", "da", "By"),
  reasonsReviewed: L("ได้ทบทวนเหตุผลของแพทย์แล้ว", "Motivi del prescrittore esaminati.", "Prescriber override reasons reviewed."),
  nothingDispensed: L("ไม่มีการจ่ายยาจากหน้านี้ คำสั่งของแพทย์ยังคงอยู่ในบันทึก", "Da qui non si dispensa nulla; l'ordine del prescrittore resta nel registro.", "Nothing is dispensed from this screen; the prescriber's order stands on the record."),
  returnedTo: L("ส่งกลับให้", "Restituito a", "Returned to"),
  note: L("หมายเหตุ", "Nota", "Note"),
  title: L("ใบสั่งยาใหม่", "Nuove prescrizioni", "New prescriptions"),
  fixture: L("ตัวอย่าง", "Esempio", "Fixture"),
  none: L("ไม่มีใบสั่งยารออยู่", "Nessuna prescrizione in attesa", "No prescriptions waiting"),
  noneBody: L("คำสั่งที่แพทย์ส่งมาจะปรากฏที่นี่เพื่อตรวจสอบ", "Gli ordini inviati dai medici compaiono qui per la verifica.", "Orders submitted by doctors appear here for verification."),
  highNoOverride: (n: number) => L(`สูง ${n} ไม่มีเหตุผลแพทย์`, `${n} alti, nessuna deroga`, `${n} high, no override`),
  toCheck: (n: number) => L(`ต้องตรวจ ${n}`, `${n} da verificare`, `${n} to check`),
  noRule: L("ไม่มีการแจ้งเตือนจากกฎ", "Nessun avviso dalle regole", "No rule alerts"),
};

function OrderCard({ o, lang, busy, onAction }: { o: MedicationOrder; lang: Lang; busy: boolean; onAction: (a: "verify" | "return", note?: string) => Promise<boolean> }) {
  const [form, setForm] = useState(false);
  const [note, setNote] = useState("");
  const nHigh = openHighChecks(o).length;
  const block = nHigh ? OL.blockHigh(nHigh)[lang] : null;
    const open = o.status === "submitted";
  const hasHigh = o.checks.some((c) => c.severity === "high");
  return (
    <li className="rounded-2xl border border-rule/70 bg-sheet p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-ocean-tint text-ocean"><Icon name="pill" /></span>
        <div className="min-w-0 flex-1 basis-60">
          <h3 className="text-lead font-bold">{orderTitle(o)}</h3>
          <p className="text-small text-ink-soft">{o.route} · {o.frequency}{o.duration ? ` · ${o.duration}` : ""}{o.drugClass ? ` · ${o.drugClass.replace(/_/g, " ")}` : ""}</p>
          <p className="text-small text-ink-soft">{OL.prescribedBy[lang]} {o.orderedBy}, {clock(o.at)}</p>
        </div>
        <Badge tone={ST_TONE[o.status]}>{OL.status[o.status][lang]}</Badge>
      </div>

      {o.checks.length === 0 ? (
        <p className="mt-3 text-small text-ink-soft">{OL.noAlerts[lang]}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {o.checks.map((c) => {
            const ov = overrideOf(o, c.id);
            const high = c.severity === "high" && !ov;
            const unchecked = /UNCHECKED|UNKNOWN/.test(c.ruleId); // the rule could not check: shown as needs-check, never as safe
            return (
              <li key={c.id} className={`rounded-xl p-3 ${high ? "border border-signal/50 bg-signal-tint ring-1 ring-signal/20" : c.severity === "high" || unchecked ? "border border-warn/30 bg-warn-tint" : "border border-rule/70 bg-paper"}`}>
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={c.severity === "high" ? (high ? "signalOutline" : "pencil") : unchecked ? "pencil" : "outline"} icon={<Icon name="triangle-alert" size={14} />}>{c.severity === "high" ? OL.high[lang] : OL.moderate[lang]}</Badge>
                  <span className="font-bold"><LangMorph text={KIND_LABEL[c.kind]} lang={lang} /></span>
                  <span className="text-micro text-ink-soft">{c.ruleId}</span>
                </p>
                <p className="mt-1 text-body"><LangMorph text={c.message} lang={lang} /></p>
                <p className="text-small text-ink-soft"><span className="font-semibold">{OL.check[lang]}: </span><LangMorph text={c.action} lang={lang} /></p>
                {c.source && <p className="text-micro text-graphite">{c.source}</p>}
                {ov ? (
                  <p className="mt-2 rounded-lg bg-sheet px-3 py-2 text-small"><span className="font-bold">{OL.override[lang]}: </span>{ov.reason} <span className="text-ink-soft">({ov.by}, {clock(ov.at)})</span></p>
                ) : c.severity === "high" ? (
                  <p className="mt-2 text-small font-semibold text-signal">{OL.noOverride[lang]}.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {open && !form && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" className={sm} disabled={busy || !!block} aria-describedby={`ob-${o.id}`} onClick={() => onAction("verify")} icon={<Icon name="circle-check" size={16} />}>{OL.verify[lang]}</Button>
          <Button className={sm} disabled={busy} onClick={() => { setForm(true); setNote(""); }}>{OL.returnBtn[lang]}</Button>
          {block && <p id={`ob-${o.id}`} role="status" className="basis-full text-small font-semibold text-warn">{OL.blocked[lang]}: {block}</p>}
          {!block && hasHigh && <p id={`ob-${o.id}`} className="basis-full text-small text-ink-soft">{OL.overridesOk[lang]}</p>}
        </div>
      )}
      {open && form && (
        <form className="mt-3 flex flex-col gap-2" onSubmit={async (e) => { e.preventDefault(); if (note.trim() && (await onAction("return", note.trim()))) setForm(false); }} onKeyDown={(e) => { if (e.key === "Escape") setForm(false); }}>
          <Field autoFocus required multiline maxLength={500} label={OL.noteLabel[lang]} hint={OL.noteHint[lang]} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className={sm} disabled={busy || !note.trim()}>{OL.returnOrder[lang]}</Button>
            <Button className={sm} onClick={() => setForm(false)}>{U.cancel[lang]}</Button>
          </div>
        </form>
      )}

      {o.status === "verified" && o.pharmacist && (
        <p role="status" className="mt-3 rounded-xl border border-teal/30 bg-teal-tint p-3 text-small text-ink">
          <span className="flex items-center gap-2 font-bold text-teal"><Icon name="circle-check" size={16} />{OL.verified[lang]}</span>
          {OL.by[lang]} {o.pharmacist.by}, {clock(o.pharmacist.at)}. {hasHigh ? OL.reasonsReviewed[lang] : ""} {OL.nothingDispensed[lang]}
        </p>
      )}
      {o.status === "returned" && o.pharmacist && (
        <p role="status" className="mt-3 rounded-xl border border-warn/30 bg-warn-tint p-3 text-small text-ink">
          <span className="font-bold text-warn">{OL.returnedTo[lang]} {o.orderedBy}</span> {OL.by[lang]} {o.pharmacist.by}, {clock(o.pharmacist.at)}.{o.pharmacist.note ? <> {OL.note[lang]}: {o.pharmacist.note}</> : null}
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
      <CardHeader title={<span id="h-orders">{OL.title[lang]}</span>} action={<span className="flex items-center gap-2">{fixture && <Badge tone="pencil">{OL.fixture[lang]}</Badge>}<span className="text-small text-ink-soft">{visible.length}</span></span>} />
      <ul className="flex flex-col gap-3">
        {sorted.map((o) => <OrderCard key={o.id} o={o} lang={lang} busy={busy} onAction={(a, note) => run(() => submitOrder(sessionId, o.id, a, note))} />)}
      </ul>
    </Card>
  );
}

/** Queue of submitted orders across sessions; unhandled high alerts pinned first. */
export function PrescriptionQueue() {
  const { entries, now, lang } = usePharmacy();
  const rows = (entries ?? []).flatMap(({ session, fixture }) => pendingOrders(session).map((o) => ({ session, fixture, o })))
    .sort((a, b) => Number(openHighChecks(b.o).length > 0) - Number(openHighChecks(a.o).length > 0) || a.o.at.localeCompare(b.o.at));
  if (!entries) return <div aria-busy="true" className="flex flex-col gap-3 p-5">{[0, 1].map((i) => <span key={i} className="mx-blank !block !h-14 !w-full !rounded-2xl" />)}</div>;
  if (rows.length === 0) return <EmptyState icon={<Icon name="inbox" />} title={OL.none[lang]} body={OL.noneBody[lang]} />;
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
                {high > 0 && <Badge tone="signalOutline">{OL.highNoOverride(high)[lang]}</Badge>}
                {overridden > 0 && <Badge tone="pencil">{OL.override[lang]}</Badge>}
                {mod > 0 && <Badge tone="outline">{OL.toCheck(mod)[lang]}</Badge>}
                {o.checks.length === 0 && <span className="text-small text-ink-soft">{OL.noRule[lang]}</span>}
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
