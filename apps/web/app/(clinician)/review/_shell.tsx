"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { IntakeSession, Lang } from "@medx/shared";
import { Badge } from "@/components/ui";
import { Morph as LangMorph } from "./_morph";
import { LANG_OPTIONS, REVIEWERS, clock, fetchQueue, sortQueue, topSeverity, waited } from "./_lib";
import { tr, type TKey } from "./_i18n";

const STATUS_KEY: Record<IntakeSession["status"], TKey> = {
  collecting: "stCollecting", escalated: "urgent", awaiting_review: "stReview", needs_human: "needsHuman", approved: "stApproved", taken_over: "stTakenOver",
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; reviewer: string; setReviewer: (r: string) => void; now: number; refreshQueue: () => void };
const C = createContext<Ctx | null>(null);
export const useClinician = () => {
  const c = useContext(C);
  if (!c) throw new Error("useClinician outside Shell");
  return c;
};

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: keep in memory only */ } },
};

export function Shell({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [reviewer, setReviewerState] = useState(REVIEWERS[0]);
  const [now, setNow] = useState(0);
  const [queue, setQueue] = useState<IntakeSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id?: string }>();
  const router = useRouter();

  useEffect(() => {
    const l = store.get("medx.lang");
    if (l === "th" || l === "it" || l === "en") setLangState(l);
    const r = store.get("medx.reviewer");
    if (r && REVIEWERS.includes(r)) setReviewerState(r);
  }, []);
  const setLang = (l: Lang) => { setLangState(l); store.set("medx.lang", l); };
  const setReviewer = (r: string) => { setReviewerState(r); store.set("medx.reviewer", r); };

  const refreshQueue = useCallback(() => {
    fetchQueue().then((q) => { setQueue(q); setError(null); }).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    refreshQueue();
    setNow(Date.now());
    const t = setInterval(() => { refreshQueue(); setNow(Date.now()); }, 5000);
    return () => clearInterval(t);
  }, [refreshQueue]);

  const sorted = useMemo(() => (queue ? sortQueue(queue) : null), [queue]);
  // Land on the most urgent intake when no code is chosen.
  const landed = useRef(false);
  useEffect(() => {
    if (!id && sorted?.length && !landed.current) { landed.current = true; router.replace(`/review/${sorted[0].id}`); }
  }, [id, sorted, router]);

  return (
    <C.Provider value={{ lang, setLang, reviewer, setReviewer, now, refreshQueue }}>
      <div className="flex h-dvh flex-col overflow-clip">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b border-rule px-4 min-[1280px]:px-6">
          <Link href="/" className="font-serif text-lead font-medium">MedX Bridge</Link>
          <span className="hidden text-small text-ink-soft min-[960px]:inline">{tr("clinicianReview", lang)}</span>
          <div className="ml-auto flex items-center gap-4">
            <label className="flex items-center gap-2 text-small text-ink-soft">
              <span className="hidden min-[1100px]:inline">{tr("signedInAs", lang)}</span>
              <select
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                className="h-8 rounded-control border border-rule-strong bg-sheet px-2 text-small text-ink"
                aria-label={tr("signedInAs", lang)}
              >
                {REVIEWERS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <div role="radiogroup" aria-label="Clinician language" className="flex overflow-hidden rounded-control border border-rule-strong">
              {LANG_OPTIONS.map((o) => (
                <button
                  key={o.lang}
                  type="button"
                  role="radio"
                  aria-checked={lang === o.lang}
                  lang={o.lang}
                  onClick={() => setLang(o.lang)}
                  className={`h-8 px-3 text-small font-medium transition-colors duration-quick ease-pen ${lang === o.lang ? "bg-ink text-sheet" : "bg-sheet text-ink hover:bg-paper"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-4 pb-4 pt-4 min-[960px]:grid-cols-[288px_minmax(0,1fr)] min-[1280px]:px-6 min-[1280px]:pb-6">
          <nav aria-label={tr("queue", lang)} className="flex min-h-0 flex-col bg-sheet shadow-sheet max-[959px]:hidden">
            <h2 className="border-b border-rule px-4 py-3 text-body">{tr("queue", lang)}</h2>
            <QueueList sorted={sorted} error={error} activeId={id} retry={refreshQueue} />
          </nav>
          <div className="min-[960px]:hidden">
            <label className="flex flex-col gap-1 text-small text-ink-soft">
              {tr("queue", lang)}
              <select
                value={id ?? ""}
                onChange={(e) => e.target.value && router.push(`/review/${e.target.value}`)}
                className="h-10 rounded-control border border-rule-strong bg-sheet px-2 text-body text-ink"
              >
                <option value="">{tr("selectIntake", lang)}</option>
                {sorted?.map((s) => <option key={s.id} value={s.id}>{s.code} {tr(STATUS_KEY[s.status], lang)}</option>)}
              </select>
            </label>
          </div>
          <main className="flex min-h-0 min-w-0 flex-col">{children}</main>
        </div>
      </div>
    </C.Provider>
  );
}

function QueueList({ sorted, error, activeId, retry }: { sorted: IntakeSession[] | null; error: string | null; activeId?: string; retry: () => void }) {
  const { lang, now } = useClinician();
  if (!sorted && error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 p-4 text-small">
        <p className="text-signal">{tr("queueFailed", lang)}: {error}</p>
        <button type="button" onClick={retry} className="underline underline-offset-4">{tr("retry", lang)}</button>
      </div>
    );
  }
  if (!sorted) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3 p-4" aria-label="Loading queue">
        {[0, 1, 2, 3].map((i) => <span key={i} className="mx-blank !block !h-5 !w-full" />)}
      </div>
    );
  }
  return (
    <>
      {error && <p role="status" className="border-b border-rule px-4 py-2 text-small text-signal">{tr("queueStale", lang)}: {error}.</p>}
      {sorted.length === 0 ? (
        <p className="p-4 text-small text-ink-soft">{tr("queueEmpty", lang)}</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {sorted.map((s) => {
            const sev = topSeverity(s);
            const cc = s.summary?.fields.find((f) => f.key === "chief_complaint");
            const active = s.id === activeId;
            const pending = (s.summary?.redFlags ?? []).some((h) => !h.review);
            const row = s.status === "escalated" && sev === "urgent" ? "bg-signal-tint" : "bg-sheet hover:bg-paper";
            return (
              <li key={s.id} className="border-b border-rule">
                <Link
                  href={`/review/${s.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col justify-center gap-0.5 px-4 py-1.5 transition-colors duration-quick ease-pen ${row} ${active ? "outline outline-2 -outline-offset-2 outline-ink" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">{s.code}</span>
                    {s.status === "escalated" ? (
                      <Badge tone={sev === "emergency" ? "signal" : "signalOutline"}>{tr(sev === "emergency" ? "emergency" : "urgent", lang)}</Badge>
                    ) : (
                      <Badge tone={s.status === "approved" ? "ink" : s.status === "needs_human" || s.status === "collecting" ? "pencil" : "outline"}>{tr(STATUS_KEY[s.status], lang)}</Badge>
                    )}
                    <span className="ml-auto whitespace-nowrap text-micro text-ink-soft">
                      {s.status === "approved" ? clock(s.updatedAt) : now ? waited(s.createdAt, now, tr("min", lang)) : ""}
                    </span>
                  </span>
                  <span className="truncate text-small text-ink-soft">
                    {s.status === "escalated" && pending && `${tr("notAcked", lang)} `}
                    {s.status === "escalated" && s.summary?.redFlags[0] ? (
                      <LangMorph text={s.summary.redFlags[0].label} lang={lang} />
                    ) : s.summary?.abstained || s.status === "needs_human" ? (
                      <span className="text-graphite">{tr("needsHuman", lang)}</span>
                    ) : cc?.value && ["supported", "edited", "approved"].includes(cc.status) ? (
                      <LangMorph text={cc.value} lang={lang} />
                    ) : cc?.value ? (
                      <span className="text-graphite">{tr("unverified", lang)}</span>
                    ) : (
                      <span className="text-graphite">{tr("noComplaint", lang)}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
