"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { Lang } from "@medx/shared";
import { Badge, Card, EmptyState, GradientHero, Icon, LangMorph, SegmentedControl, buttonClasses, type IconName } from "@/components/ui";
import { PrescriptionQueue, stageCounts } from "./_orders";
import { matchesCode } from "../_shared/codeSearch";
import { L, C, LANG_NAME, PHARM_STATUS_LABEL, STAGES, STAGE_LABEL, U, alertNeedsFollowUp, alertsOf, isAbstained, medsOf, openFlags, openHigh, pharmStatus, redFlagsOf, stageRows, waited, type Stage } from "./_lib";
import { usePharmacy, type Entry } from "./_shell";

type Tab = "recon" | "rx";
const TAB_KEY = "medx.pharmacy.tab"; // per-viewer convenience only
const readTab = (): Tab | null => { try { const v = localStorage.getItem(TAB_KEY); return v === "recon" || v === "rx" ? v : null; } catch { return null; } };
const isStage = (v: string | null): v is Stage => !!v && (STAGES as string[]).includes(v);

const Q = {
  heroVerify: (n: number) => L(`ใบสั่งยารอตรวจ ${n} รายการ`, n === 1 ? "1 prescrizione da verificare" : `${n} prescrizioni da verificare`, n === 1 ? "1 prescription to verify" : `${n} prescriptions to verify`),
  heroDispense: (n: number) => L(`ยารอจัดและตรวจขั้นสุดท้าย ${n} รายการ`, n === 1 ? "1 farmaco da dispensare" : `${n} farmaci da dispensare`, n === 1 ? "1 medicine to dispense" : `${n} medicines to dispense`),
  heroCall: (n: number) => L(`ผู้ป่วยรอเรียกรับยา ${n} คน`, n === 1 ? "1 paziente da chiamare" : `${n} pazienti da chiamare`, n === 1 ? "1 patient to call" : `${n} patients to call`),
  heroCalm: L("ไม่มีงานรอในห้องยา", "Nessun lavoro in attesa in farmacia", "Nothing is waiting in the pharmacy"),
  heroSub: L(
    "เภสัชกรคนแรกตรวจใบสั่งยา เภสัชกรอีกคนจัดยาและตรวจขั้นสุดท้าย แล้วจึงเรียกผู้ป่วยมารับยา ทุกขั้นอยู่ในบันทึกการตรวจสอบ",
    "Il primo farmacista verifica, un secondo farmacista prepara e fa il controllo finale, poi il paziente viene chiamato. Ogni passo è nel registro.",
    "Pharmacist 1 verifies, a second pharmacist picks and does the final check, then the patient is called. Every step is in the audit log.",
  ),
  openNext: L("เปิดรายการถัดไป", "Apri il prossimo", "Open next"),
  stages: L("ขั้นตอนห้องยา", "Fasi della farmacia", "Pharmacy stages"),
  pending: (n: number) => L(`รอเทียบ ${n}`, `${n} in attesa`, `${n} pending`),
  urgent: (n: number) => L(`การแจ้งเตือนสูงและสัญญาณอันตรายที่รอทบทวน ${n}`, `${n} avvisi alti e segnali d'allarme da rivedere`, `${n} high alerts and red flags awaiting review`),
  done: (n: number) => L(`เทียบแล้ว ${n}`, `${n} riconciliati`, `${n} reconciled`),
  prescriptions: L("ใบสั่งยา", "Prescrizioni", "Prescriptions"),
};
const STAGE_ICON: Record<Stage, IconName> = { verify: "clipboard-list", dispense: "package-check", call: "megaphone", ready: "bell", collected: "circle-check" };

/** Stage counts on the hero: each tile opens that stage below (white tile = the open one). */
function StageStrip({ counts, current, onPick, lang }: { counts: Record<Stage, number> | null; current: Stage | null; onPick: (s: Stage) => void; lang: Lang }) {
  return (
    <ol aria-label={Q.stages[lang]} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {STAGES.map((k, i) => {
        const on = current === k;
        return (
          <li key={k} className={k === "collected" ? "col-span-2 sm:col-span-1" : undefined}>
            <button
              type="button" aria-pressed={on} onClick={() => onPick(k)}
              className={`flex h-full w-full flex-col gap-1 rounded-2xl px-3.5 py-3 text-left transition-[background-color,color,box-shadow] duration-base ease-pen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sheet ${on ? "bg-sheet text-ink shadow-sheet-lifted" : "bg-white/12 text-on-primary ring-1 ring-inset ring-white/25 hover:bg-white/20"}`}
            >
              <span className={`flex items-center gap-2 text-small font-semibold ${on ? "text-ink-soft" : "text-on-primary/90"}`}>
                <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-micro font-bold ${on ? "bg-ocean-tint text-ocean" : "bg-white/20"}`}>{i + 1}</span>
                <span className="min-w-0">{STAGE_LABEL[k][lang]}</span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="text-stat font-extrabold tabular-nums">{counts ? counts[k] : "-"}</span>
                <Icon name={STAGE_ICON[k]} size={18} className={on ? "text-ocean" : "text-on-primary/80"} />
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function Queue() {
  const { entries, error, lang, now } = usePharmacy();
  const list = entries ?? [];
  // Prescriptions first: the two-stage check (verify, dispense, call) is the pharmacist's main queue.
  const [tab, setTabState] = useState<Tab>("rx");
  const [stage, setStage] = useState<Stage | null>(null);
  const [query, setQuery] = useState("");
  const searchId = useId();
  useEffect(() => {
    // /pharmacy?stage=dispense (links from the ops flow strip) opens that stage; otherwise the remembered tab.
    const s = new URLSearchParams(window.location.search).get("stage");
    if (isStage(s)) { setTabState("rx"); setStage(s); return; }
    const t = readTab(); if (t) setTabState(t);
  }, []);
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* storage blocked */ } };
  const pick = (s: Stage) => { setTab("rx"); setStage(s); };

  const sc = entries ? stageCounts(list, now) : null;
  const rows = stageRows(list, now);
  const next = rows.verify[0] ?? rows.dispense[0];
  const title = !sc ? C.pharmacyQueue[lang] : sc.verify ? Q.heroVerify(sc.verify)[lang] : sc.dispense ? Q.heroDispense(sc.dispense)[lang] : sc.call ? Q.heroCall(sc.call)[lang] : Q.heroCalm[lang];
  const shown = query.trim() ? list.filter((e) => matchesCode(e.session.code, query)) : list;
  const rxCount = sc ? sc.verify + sc.dispense + sc.call + sc.ready : 0;

  return (
    <div lang={lang} className="flex flex-col gap-6">
      <h1 className="sr-only">{C.pharmacyQueue[lang]}</h1>
      <GradientHero
        title={title}
        subtitle={Q.heroSub[lang]}
        action={next ? (
          <Link href={`/pharmacy/${next.session.id}#order-${next.o.id}`} className={buttonClasses({ variant: "onDark" })}>
            {Q.openNext[lang]}<span className="sr-only">: {next.session.code}</span><Icon name="arrow-right" size={18} />
          </Link>
        ) : undefined}
      >
        <StageStrip counts={sc} current={tab === "rx" ? stage : null} onPick={pick} lang={lang} />
      </GradientHero>

      {error && <p role="status" className="rounded-2xl bg-warn-tint px-4 py-2 text-small font-semibold text-warn">{C.notRefreshed[lang]}: {error}.</p>}

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-5 pb-3 pt-5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <h2 className="text-lead font-bold">{C.queue[lang]}</h2>
            <SegmentedControl ariaLabel={C.queue[lang]} value={tab} onChange={setTab} options={[{ value: "rx", label: `${Q.prescriptions[lang]} (${rxCount})` }, { value: "recon", label: C.reconTab[lang] }]} />
          </div>
          <div role="search" className="flex w-full flex-col gap-1 sm:w-64">
            <label htmlFor={searchId} className="text-micro font-semibold text-ink-soft">{C.findCode[lang]}</label>
            <span className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite" />
              <input
                id={searchId} type="search" inputMode="text" autoComplete="off" spellCheck={false} maxLength={12}
                value={query} onChange={(e) => setQuery(e.target.value)} placeholder={C.findCodeHint[lang]}
                className="h-10 w-full rounded-full border border-rule-strong/60 bg-sheet pl-10 pr-9 text-body text-ink transition-[border-color,box-shadow] duration-quick ease-pen hover:border-ink-soft focus-visible:border-ocean focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ocean/15"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label={C.clearSearch[lang]} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-graphite hover:bg-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ocean">
                  <Icon name="x" size={14} />
                </button>
              )}
            </span>
          </div>
        </div>
        {tab === "rx" ? (
          <PrescriptionQueue entries={entries ? shown : null} stage={stage} onStage={setStage} query={query} onClearQuery={() => setQuery("")} />
        ) : (
          <ReconList entries={entries ? shown : null} all={list} query={query} onClearQuery={() => setQuery("")} lang={lang} now={now} />
        )}
      </Card>
    </div>
  );
}

/** Medicine reconciliation of the intake (patient's own medicines and allergies), one row per intake. */
function ReconList({ entries, all, query, onClearQuery, lang, now }: { entries: Entry[] | null; all: Entry[]; query: string; onClearQuery: () => void; lang: Lang; now: number }) {
  const { fresh } = usePharmacy();
  if (!entries) {
    return (
      <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3 p-5">
        {[0, 1, 2].map((i) => <span key={i} className="mx-skeleton block h-16 w-full rounded-2xl" />)}
      </div>
    );
  }
  const pending = all.filter((e) => pharmStatus(e.session) !== "reconciled").length;
  const urgent = all.reduce((n, e) => n + openHigh(e.session).length + openFlags(e.session).length, 0);
  const done = all.length - pending;
  const calm = urgent === 0;
  return (
    <div className="flex flex-col gap-3 p-4 pt-1">
      <p className="flex flex-wrap items-center gap-2 text-small">
        <Badge tone="outline" icon={<Icon name="clipboard-list" size={14} />}>{Q.pending(pending)[lang]}</Badge>
        {urgent > 0 ? <Badge tone="signalOutline" icon={<Icon name="triangle-alert" size={14} />}>{Q.urgent(urgent)[lang]}</Badge> : null}
        <Badge tone="teal" icon={<Icon name="circle-check" size={14} />}>{Q.done(done)[lang]}</Badge>
      </p>
      {entries.length === 0 ? (
        query.trim() ? (
          <EmptyState icon={<Icon name="search" />} title={C.noCodeMatch(query.trim())[lang]} body={C.noCodeMatchBody[lang]} action={<button type="button" onClick={onClearQuery} className={buttonClasses({ size: "sm" })}>{C.clearSearch[lang]}</button>} />
        ) : (
          <EmptyState mascot={calm ? "pointing" : undefined} icon={<Icon name="inbox" />} title={C.noIntakes[lang]} body={C.noIntakesBody[lang]} />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map(({ session: s, fixture }) => {
            const abst = isAbstained(s);
            // Recorded rule alerts stay counted even when the summary abstained. An acknowledged alert is reviewed
            // but still needs follow-up (resolved or false alarm), so it keeps its chip until then.
            const open = alertsOf(s).filter(alertNeedsFollowUp);
            const high = open.filter((a) => a.severity === "high").length;
            const flags = openFlags(s).length;
            const flagsAll = redFlagsOf(s).length;
            const mod = open.length - high;
            const cc = s.summary?.fields.find((f) => f.key === "chief_complaint");
            const st = pharmStatus(s);
            const hot = high > 0 || flags > 0;
            const isNew = fresh.has(s.id) && !hot;
            return (
              <li key={s.id}>
                {/* White row; urgency is carried by the red icon disc and the chip, not by the row fill. */}
                <Link
                  href={`/pharmacy/${s.id}`}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-sheet p-4 transition-[transform,box-shadow,background-color,border-color] duration-base ease-pen hover:-translate-y-0.5 hover:shadow-sheet-lifted ${isNew ? "border-ocean/50 bg-ocean-tint/40 ring-4 ring-ocean-tint" : "border-rule/70"}`}
                >
                  <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full ${hot ? "bg-signal text-on-signal" : "bg-ocean-tint text-ocean"}`}><Icon name={hot ? "triangle-alert" : "pill"} /></span>
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="text-lead font-bold tabular-nums">{s.code}</span>
                      <span lang={s.patientLang} className="text-small text-ink-soft">{LANG_NAME[s.patientLang]}</span>
                      {isNew && <Badge tone="ocean">{C.newArrival[lang]}</Badge>}
                      {fixture && <span className="text-micro text-graphite"><LangMorph text={C.fixtureTag} lang={lang} /></span>}
                    </span>
                    <span className="block truncate text-small text-ink-soft">
                      {abst ? <LangMorph text={U.needsHuman} lang={lang} /> : cc?.value && cc.status !== "missing"
                        ? (cc.status === "unsupported" ? <span className="mx-pencil"><span className="sr-only">{C.unverified[lang]}: </span><span aria-hidden="true" className="mr-1 font-semibold">{C.unverified[lang]}:</span><LangMorph text={cc.value} lang={lang} /></span> : <LangMorph text={cc.value} lang={lang} />)
                        : C.noComplaint[lang]}
                      {!abst && <span className="ml-2 text-graphite">{C.medicinesN(medsOf(s).length)[lang]}</span>}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {flags > 0 && <Badge tone="signal" icon={<Icon name="triangle-alert" size={14} />}>{C.redFlagsN(flags)[lang]}</Badge>}
                    {high > 0 && <Badge tone="signalOutline">{C.highN(high)[lang]}</Badge>}
                    {mod > 0 && <Badge tone="pencil">{C.toCheckN(mod)[lang]}</Badge>}
                    {abst && <Badge tone="pencil">{U.needsHuman[lang]}</Badge>}
                    {!abst && flags === 0 && flagsAll > 0 && <span className="text-small text-ink-soft">{C.redFlagsDone(flagsAll)[lang]}</span>}
                    {open.length === 0 && flagsAll === 0 && !abst && <span className="text-small text-ink-soft">{alertsOf(s).length ? C.allHandled[lang] : C.noRuleAlerts[lang]}</span>}
                    <Badge tone={st === "reconciled" ? "teal" : st === "in_review" ? "ocean" : "outline"}>{PHARM_STATUS_LABEL[st][lang]}</Badge>
                    <span className="w-16 text-right text-small text-ink-soft tabular-nums">{st === "reconciled" ? "" : now ? waited(s.createdAt, now) : ""}</span>
                  </span>
                  <Icon name="chevron-right" className="text-graphite max-sm:hidden" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
