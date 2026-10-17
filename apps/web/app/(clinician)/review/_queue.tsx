"use client";
import Link from "next/link";
import { useState } from "react";
import type { IntakeSession, Lang, SessionStatus } from "@medx/shared";
import { Badge, Card, EmptyState, Icon, LangMorph, Pill, StatTile } from "@/components/ui";
import { cap, clock, topSeverity, waited } from "./_lib";
import { fmt, tr, type TKey } from "./_i18n";
import { useClinician } from "./_shell";

export const STATUS_KEY: Record<SessionStatus, TKey> = {
  collecting: "stCollecting", escalated: "urgent", awaiting_review: "stReview", needs_human: "needsHuman", approved: "stApproved", taken_over: "stTakenOver",
};
const LANG_BADGE: Record<Lang, string> = { th: "TH", it: "IT", en: "EN" };

/** Queue and header text for the complaint. Only verified values read as fact. */
export function Complaint({ s, lang, onDark = false }: { s: IntakeSession; lang: Lang; onDark?: boolean }) {
  const cc = s.summary?.fields.find((f) => f.key === "chief_complaint");
  // A red flag keeps its label as the subject line in every status, so taking over never erases why the case matters.
  if (s.summary?.redFlags[0]) return <LangMorph text={s.summary.redFlags[0].label} lang={lang} />;
  if (s.summary?.abstained || s.status === "needs_human") {
    const r = s.summary?.abstainReason;
    return <span className={onDark ? "" : "text-graphite"}>{r ? tr(`ar_${r}` as TKey, lang) : tr("needsHuman", lang)}</span>;
  }
  if (cc?.value && ["supported", "edited", "approved"].includes(cc.status)) return <LangMorph text={cap(cc.value)} lang={lang} />;
  if (cc?.value) return <span className={onDark ? "" : "text-warn"}>{tr("unverified", lang)}</span>;
  return <span className={onDark ? "" : "text-graphite"}>{tr("noComplaint", lang)}</span>;
}

export function StatusChip({ s, lang }: { s: IntakeSession; lang: Lang }) {
  const sev = topSeverity(s);
  if (s.status === "escalated") {
    return (
      <Badge tone={sev === "emergency" ? "signal" : "signalOutline"} icon={<Icon name="triangle-alert" size={12} />}>
        {tr(sev === "emergency" ? "emergency" : "urgent", lang)}
      </Badge>
    );
  }
  const tone = s.status === "approved" ? "teal" : s.status === "needs_human" ? "pencil" : s.status === "collecting" ? "outline" : "ocean";
  return <Badge tone={tone} icon={s.status === "approved" ? <Icon name="check" size={12} /> : undefined}>{tr(STATUS_KEY[s.status], lang)}</Badge>;
}

/** Shown beside the status when a red flag exists but the case is no longer in the escalated state. */
export function FlagChip({ s, lang }: { s: IntakeSession; lang: Lang }) {
  const hits = s.summary?.redFlags ?? [];
  if (!hits.length || s.status === "escalated") return null;
  const open = hits.some((h) => !h.review);
  return <Badge tone="signalOutline" icon={<Icon name="triangle-alert" size={12} />}>{tr(open ? "flagOpen" : "flagAck", lang)}</Badge>;
}

export function LangBadge({ lang, className = "" }: { lang: Lang; className?: string }) {
  return (
    <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full bg-ocean-tint text-small font-extrabold text-ocean ${className}`}>
      {LANG_BADGE[lang]}
    </span>
  );
}

export function QueueStats() {
  const { sorted, lang } = useClinician();
  const n = (f: (s: IntakeSession) => boolean) => (sorted ? sorted.filter(f).length : null);
  const today = new Date().toDateString();
  const esc = n((s) => s.status === "escalated");
  return (
    <div className="grid grid-cols-2 gap-4 min-[1280px]:grid-cols-4">
      <StatTile label={tr("statEscalated", lang)} value={esc} tone={esc ? "signal" : "default"} icon={<Icon name="triangle-alert" size={16} />} />
      <StatTile label={tr("statAwaiting", lang)} value={n((s) => s.status === "awaiting_review")} tone="ocean" icon={<Icon name="clipboard-list" size={16} />} />
      <StatTile label={tr("statNeedsHuman", lang)} value={n((s) => s.status === "needs_human")} icon={<Icon name="user" size={16} />} />
      <StatTile label={tr("statApprovedToday", lang)} value={n((s) => s.status === "approved" && new Date(s.updatedAt).toDateString() === today)} tone="teal" icon={<Icon name="circle-check" size={16} />} />
    </div>
  );
}

type Filter = "all" | "escalated" | "review";

/** Queue as rounded white cards. `compact` is the narrow column beside an open review. */
export function QueueCard({ activeId, compact = false }: { activeId?: string; compact?: boolean }) {
  const { sorted, error, lang, now, refreshQueue, fresh } = useClinician();
  const [filter, setFilter] = useState<Filter>("all");
  const [showEmpty, setShowEmpty] = useState(false);

  const body = () => {
    if (!sorted && error) {
      return (
        <div role="alert" className="flex flex-col items-start gap-2 p-5 text-small">
          <p className="text-signal">{tr("queueFailed", lang)}: {error}</p>
          <button type="button" onClick={refreshQueue} className="font-semibold text-ocean underline underline-offset-4">{tr("retry", lang)}</button>
        </div>
      );
    }
    if (!sorted) return <div aria-busy="true" className="flex flex-col gap-3">{[0, 1, 2].map((i) => <span key={i} className="mx-skeleton !h-16" />)}</div>;
    const isEmpty = (s: IntakeSession) => !s.turns.some((t) => t.role === "patient");
    const empties = sorted.filter(isEmpty);
    const shown = sorted.filter((s) => (showEmpty || !isEmpty(s)) && (filter === "all" || (filter === "escalated" ? s.status === "escalated" : ["awaiting_review", "needs_human"].includes(s.status))));
    if (!shown.length && !empties.length) return <EmptyState mascot="pointing" title={tr("queueEmpty", lang)} />;
    return (
      <>
        {error && <p role="status" className="px-1 text-small text-signal">{tr("queueStale", lang)}: {error}.</p>}
        <ul className="flex min-h-0 flex-col gap-2.5">
          {shown.map((s) => {
            const sev = topSeverity(s);
            const pending = (s.summary?.redFlags ?? []).some((h) => !h.review);
            const active = s.id === activeId;
            return (
              <li key={s.id} className={fresh.has(s.id) ? "cl-slide rounded-2xl" : "cl-enter"}>
                <Link
                  href={`/review/${s.id}`}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-3 rounded-2xl border p-3 transition-[transform,box-shadow,background-color] duration-base ease-pen hover:-translate-y-0.5 hover:shadow-sheet-lifted",
                    s.status === "escalated" && sev === "urgent" ? "border-signal/40 bg-signal-tint" : "border-rule/70 bg-sheet",
                    active ? "ring-2 ring-ocean" : "",
                  ].join(" ")}
                >
                  <LangBadge lang={s.patientLang} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="font-bold tabular-nums text-ink">{s.code}</span>
                      <StatusChip s={s} lang={lang} />
                      <FlagChip s={s} lang={lang} />
                    </span>
                    <span className="truncate text-small text-ink-soft">
                      {s.status === "escalated" && pending && <span className="font-semibold text-signal">{tr("notAcked", lang)} </span>}
                      <Complaint s={s} lang={lang} />
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-micro text-graphite">
                    {s.status === "approved" ? clock(s.updatedAt, lang) : now ? waited(s.createdAt, now, tr("min", lang)) : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {empties.length > 0 && (
          <button type="button" onClick={() => setShowEmpty((v) => !v)} className="mt-3 text-small font-semibold text-ocean underline-offset-4 hover:underline">
            {showEmpty ? tr("hideEmpty", lang) : fmt(tr("showEmpty", lang), { n: empties.length })}
          </button>
        )}
      </>
    );
  };

  return (
    <Card padded={false} className={`flex min-h-0 flex-col ${compact ? "h-full" : ""}`} aria-label={tr("queue", lang)} role="region">
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-4">
        <h2 className="mr-auto text-lead font-bold">{tr("queue", lang)}</h2>
        <span className="flex flex-wrap items-center gap-2 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-ocean">
        {(["all", "escalated", "review"] as Filter[]).map((f) => (
          <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
            {tr(f === "all" ? "filterAll" : f === "escalated" ? "filterEscalated" : "filterReview", lang)}
          </Pill>
        ))}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{body()}</div>
    </Card>
  );
}
