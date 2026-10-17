"use client";
import Link from "next/link";
import { Badge, LangMorph } from "@/components/ui";
import { LANG_NAME, PHARM_STATUS_LABEL, alertsOf, medsOf, openHigh, pharmStatus, waited } from "./_lib";
import { usePharmacy } from "./_shell";

export function Queue() {
  const { entries, error, lang, now } = usePharmacy();
  return (
    <section aria-labelledby="queue-h" className="flex min-h-0 flex-1 flex-col bg-sheet shadow-sheet">
      <h1 id="queue-h" className="border-b border-rule px-6 py-4 text-title">Medication reconciliation queue</h1>
      {error && <p role="status" className="border-b border-rule px-6 py-2 text-small text-ink-soft">Live queue not refreshed: {error}.</p>}
      {!entries ? (
        <div aria-busy="true" aria-label="Loading queue" className="flex flex-col gap-3 p-6">
          {[0, 1, 2].map((i) => <span key={i} className="mx-blank !block !h-5 !w-full" />)}
        </div>
      ) : entries.length === 0 ? (
        <p className="p-6 text-body text-ink-soft">No intakes need reconciliation yet.</p>
      ) : (
        <>
          <p aria-hidden="true" className="hidden grid-cols-[88px_120px_minmax(0,1fr)_200px_120px_90px] gap-4 border-b border-rule px-6 py-2 text-small font-medium text-ink-soft min-[900px]:grid">
            <span>Code</span><span>Patient language</span><span>Chief complaint</span><span>Alerts</span><span>Status</span><span>Waiting</span>
          </p>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {entries.map(({ session: s, fixture }) => {
              const high = openHigh(s).length;
              const open = alertsOf(s).filter((a) => !a.review);
              const mod = open.length - high;
              const cc = s.summary?.fields.find((f) => f.key === "chief_complaint");
              const st = pharmStatus(s);
              return (
                <li key={s.id} className={`border-b border-rule ${high ? "border-l-2 border-l-signal bg-signal-tint" : "bg-sheet hover:bg-paper"}`}>
                  <Link
                    href={`/pharmacy/${s.id}`}
                    className="grid min-h-14 grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-6 py-2 min-[900px]:grid-cols-[88px_120px_minmax(0,1fr)_200px_120px_90px]"
                  >
                    <span className="font-medium">
                      {s.code}
                      {fixture && <span className="ml-2 text-micro font-normal text-graphite">fixture</span>}
                    </span>
                    <span lang={s.patientLang} className="hidden text-small text-ink-soft min-[900px]:inline">{LANG_NAME[s.patientLang]}</span>
                    <span className="truncate text-small text-ink-soft">
                      {cc?.value ? <LangMorph text={cc.value} lang={lang} /> : <span className="text-graphite">No complaint yet</span>}
                      <span className="ml-2 text-micro text-graphite">{medsOf(s).length} medicines</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {high > 0 && <Badge tone="signalOutline">{high} high</Badge>}
                      {mod > 0 && <Badge tone="outline">{mod} to check</Badge>}
                      {open.length === 0 && <span className="text-small text-ink-soft">{alertsOf(s).length ? "All handled" : "None"}</span>}
                    </span>
                    <span><Badge tone={st === "reconciled" ? "ink" : st === "in_review" ? "outline" : "pencil"}>{PHARM_STATUS_LABEL[st]}</Badge></span>
                    <span className="whitespace-nowrap text-small text-ink-soft">{st === "reconciled" ? "" : now ? waited(s.createdAt, now) : ""}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
