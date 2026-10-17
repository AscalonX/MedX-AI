"use client";
import Link from "next/link";
import { Badge, Card, EmptyState, Icon, LangMorph, StatTile } from "@/components/ui";
import { LANG_NAME, PHARM_STATUS_LABEL, U, alertsOf, isAbstained, medsOf, openFlags, openHigh, pharmStatus, waited } from "./_lib";
import { usePharmacy } from "./_shell";

export function Queue() {
  const { entries, error, lang, now } = usePharmacy();
  const list = entries ?? [];
  const pending = list.filter((e) => pharmStatus(e.session) !== "reconciled").length;
  const high = list.reduce((n, e) => n + (isAbstained(e.session) ? 0 : openHigh(e.session).length), 0);
  const flags = list.reduce((n, e) => n + openFlags(e.session).length, 0);
  const done = list.filter((e) => pharmStatus(e.session) === "reconciled").length;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Medication reconciliation queue</h1>
      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Pending reconciliation" value={entries ? pending : null} icon={<Icon name="clipboard-list" />} />
        <StatTile label="High alerts and red flags open" value={entries ? high + flags : null} tone={high + flags > 0 ? "signal" : "default"} icon={<Icon name="triangle-alert" />} />
        <StatTile label="Reconciled today" value={entries ? done : null} tone="teal" icon={<Icon name="circle-check" />} />
      </section>
      {error && <p role="status" className="text-small text-ink-soft">Live queue not refreshed: {error}.</p>}
      <Card padded={false} aria-label="Queue">
        <h2 className="px-5 pb-2 pt-5 text-lead font-bold">Queue</h2>
        {!entries ? (
          <div aria-busy="true" aria-label="Loading queue" className="flex flex-col gap-3 p-5">
            {[0, 1, 2].map((i) => <span key={i} className="mx-blank !block !h-14 !w-full !rounded-2xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={<Icon name="inbox" />} title="No intakes need reconciliation" body="New intakes with medicines appear here as patients finish." />
        ) : (
          <ul className="flex flex-col gap-3 p-4 pt-1">
            {entries.map(({ session: s, fixture }) => {
              const abst = isAbstained(s);
              const high = abst ? 0 : openHigh(s).length;
              const flags = openFlags(s).length;
              const open = abst ? [] : alertsOf(s).filter((a) => !a.review);
              const mod = open.length - high;
              const cc = s.summary?.fields.find((f) => f.key === "chief_complaint");
              const st = pharmStatus(s);
              const hot = high > 0 || flags > 0;
              return (
                <li key={s.id}>
                  <Link
                    href={`/pharmacy/${s.id}`}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border p-4 transition-[transform,box-shadow] duration-base ease-pen hover:-translate-y-0.5 hover:shadow-sheet-lifted ${hot ? "border-signal/40 bg-signal-tint" : "border-rule/70 bg-sheet"}`}
                  >
                    <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full ${hot ? "bg-signal text-on-signal" : "bg-ocean-tint text-ocean"}`}><Icon name={hot ? "triangle-alert" : "pill"} /></span>
                    <span className="min-w-0 flex-1 basis-56">
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="text-lead font-bold">{s.code}</span>
                        <span lang={s.patientLang} className="text-small text-ink-soft">{LANG_NAME[s.patientLang]}</span>
                        {fixture && <span className="text-micro text-graphite">fixture</span>}
                      </span>
                      <span className="block truncate text-small text-ink-soft">
                        {abst ? <LangMorph text={U.needsHuman} lang={lang} /> : cc?.value && cc.status !== "missing"
                          ? (cc.status === "unsupported" ? <span className="mx-pencil"><LangMorph text={cc.value} lang={lang} /></span> : <LangMorph text={cc.value} lang={lang} />)
                          : "No complaint yet"}
                        {!abst && <span className="ml-2 text-graphite">{medsOf(s).length} medicines</span>}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {flags > 0 && <Badge tone="signal" icon={<Icon name="triangle-alert" size={14} />}>{flags} red {flags === 1 ? "flag" : "flags"}</Badge>}
                      {high > 0 && <Badge tone="signalOutline">{high} high</Badge>}
                      {mod > 0 && <Badge tone="pencil">{mod} to check</Badge>}
                      {abst && <Badge tone="pencil">Needs human review</Badge>}
                      {!abst && open.length === 0 && flags === 0 && <span className="text-small text-ink-soft">{alertsOf(s).length ? "All handled" : "No rule alerts"}</span>}
                      <Badge tone={st === "reconciled" ? "teal" : st === "in_review" ? "ocean" : "outline"}>{PHARM_STATUS_LABEL[st]}</Badge>
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
