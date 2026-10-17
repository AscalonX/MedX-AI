"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, EmptyState, Icon, LangMorph, SegmentedControl, StatTile } from "@/components/ui";
import { PrescriptionQueue } from "./_orders";
import { C, LANG_NAME, PHARM_STATUS_LABEL, U, alertsOf, isAbstained, pendingOrders, medsOf, openFlags, openHigh, pharmStatus, redFlagsOf, waited } from "./_lib";
import { usePharmacy } from "./_shell";

export function Queue() {
  const { entries, error, lang, now } = usePharmacy();
  const list = entries ?? [];
  const [tab, setTab] = useState<"recon" | "rx">("recon");
  const rxCount = list.reduce((n, e) => n + pendingOrders(e.session).length, 0);
  const pending = list.filter((e) => pharmStatus(e.session) !== "reconciled").length;
  const high = list.reduce((n, e) => n + openHigh(e.session).length, 0);
  const flags = list.reduce((n, e) => n + openFlags(e.session).length, 0);
  const done = list.filter((e) => pharmStatus(e.session) === "reconciled").length;
  return (
    <div lang={lang} className="flex flex-col gap-6">
      <h1 className="sr-only">{C.queueTitle[lang]}</h1>
      <section aria-label={C.queue[lang]} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={C.pendingStat[lang]} value={entries ? pending : null} icon={<Icon name="clipboard-list" />} />
        <StatTile label={C.urgentStat[lang]} value={entries ? high + flags : null} tone={high + flags > 0 ? "signal" : "default"} icon={<Icon name="triangle-alert" />} />
        <StatTile label={C.doneStat[lang]} value={entries ? done : null} tone="teal" icon={<Icon name="circle-check" />} />
      </section>
      {error && <p role="status" className="text-small text-ink-soft">{C.notRefreshed[lang]}: {error}.</p>}
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 px-5 pb-2 pt-5">
          <h2 className="text-lead font-bold">{C.queue[lang]}</h2>
          <SegmentedControl ariaLabel="Queue" value={tab} onChange={setTab} options={[{ value: "recon", label: C.queueTitle[lang] }, { value: "rx", label: `Prescriptions (${rxCount})` }]} />
        </div>
        {tab === "rx" ? <PrescriptionQueue /> : !entries ? (
          <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3 p-5">
            {[0, 1, 2].map((i) => <span key={i} className="mx-blank !block !h-14 !w-full !rounded-2xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={<Icon name="inbox" />} title={C.noIntakes[lang]} body={C.noIntakesBody[lang]} />
        ) : (
          <ul className="flex flex-col gap-3 p-4 pt-1">
            {entries.map(({ session: s, fixture }) => {
              const abst = isAbstained(s);
              const high = openHigh(s).length; // recorded rule alerts stay counted even when the summary abstained
              const flags = openFlags(s).length;
              const flagsAll = redFlagsOf(s).length;
              const open = alertsOf(s).filter((a) => !a.review);
              const mod = open.length - high;
              const cc = s.summary?.fields.find((f) => f.key === "chief_complaint");
              const st = pharmStatus(s);
              const hot = high > 0 || flags > 0;
              return (
                <li key={s.id}>
                  {/* White row; urgency is carried by the red icon disc and the chip, not by the row fill. */}
                  <Link
                    href={`/pharmacy/${s.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-rule/70 bg-sheet p-4 transition-[transform,box-shadow] duration-base ease-pen hover:-translate-y-0.5 hover:shadow-sheet-lifted"
                  >
                    <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full ${hot ? "bg-signal text-on-signal" : "bg-ocean-tint text-ocean"}`}><Icon name={hot ? "triangle-alert" : "pill"} /></span>
                    <span className="min-w-0 flex-1 basis-56">
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="text-lead font-bold">{s.code}</span>
                        <span lang={s.patientLang} className="text-small text-ink-soft">{LANG_NAME[s.patientLang]}</span>
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
                      <span className="w-16 text-right text-small text-ink-soft">{st === "reconciled" ? "" : now ? waited(s.createdAt, now) : ""}</span>
                    </span>
                    <Icon name="chevron-right" className="text-graphite" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
