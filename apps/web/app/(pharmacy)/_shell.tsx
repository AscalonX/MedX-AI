"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuditEvent, IntakeSession, Lang, PharmacyReviewReq } from "@medx/shared";
import { Badge } from "@/components/ui";
import { FIXTURES } from "./_fixtures";
import { LANG_OPTIONS, PHARMACISTS, applyReview, fetchQueue, hasMedData, post, sortQueue } from "./_lib";

export interface Entry { session: IntakeSession; fixture: boolean }
type Submit = (id: string, body: Omit<PharmacyReviewReq, "reviewerId">) => Promise<void>;
interface Ctx {
  lang: Lang; setLang: (l: Lang) => void;
  reviewer: string; setReviewer: (r: string) => void;
  now: number;
  /** null while the first load is pending. */
  entries: Entry[] | null;
  error: string | null;
  refresh: () => void;
  submit: Submit;
  /** Locally recorded audit events for fixture sessions. */
  fixtureAudit: Record<string, AuditEvent[]>;
}
const C = createContext<Ctx | null>(null);
export const usePharmacy = () => {
  const c = useContext(C);
  if (!c) throw new Error("usePharmacy outside Shell");
  return c;
};

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: keep in memory only */ } },
};

export function Shell({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [reviewer, setReviewerState] = useState(PHARMACISTS[0]);
  const [now, setNow] = useState(0);
  const [live, setLive] = useState<IntakeSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<IntakeSession[]>([]);
  const [fixtureAudit, setFixtureAudit] = useState<Record<string, AuditEvent[]>>({});
  const fixturesRef = useRef(fixtures);
  fixturesRef.current = fixtures;

  useEffect(() => {
    const l = store.get("medx.lang");
    if (l === "th" || l === "it" || l === "en") setLangState(l);
    const r = store.get("medx.pharmacist");
    if (r && PHARMACISTS.includes(r)) setReviewerState(r);
    setFixtures(FIXTURES); // after mount: fixture timestamps are computed per page load
  }, []);
  const setLang = (l: Lang) => { setLangState(l); store.set("medx.lang", l); };
  const setReviewer = (r: string) => { setReviewerState(r); store.set("medx.pharmacist", r); };

  const refresh = useCallback(() => {
    fetchQueue().then((q) => { setLive(q); setError(null); }).catch((e: Error) => { setLive((cur) => cur ?? []); setError(e.message); });
  }, []);
  useEffect(() => {
    refresh();
    setNow(Date.now());
    const t = setInterval(() => { refresh(); setNow(Date.now()); }, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // Live sessions that carry medication data win. Fixtures appear only when there are none.
  const entries = useMemo<Entry[] | null>(() => {
    if (live === null) return null;
    const real = live.filter(hasMedData).map((session) => ({ session, fixture: false }));
    if (real.length) return sortQueue(real.map((e) => e.session)).map((s) => ({ session: s, fixture: false }));
    return sortQueue(fixtures).map((session) => ({ session, fixture: true }));
  }, [live, fixtures]);

  const submit = useCallback<Submit>(async (id, body) => {
    const req: PharmacyReviewReq = { reviewerId: reviewer, ...body };
    const local = fixturesRef.current.find((s) => s.id === id);
    if (local) {
      const at = new Date().toISOString();
      setFixtures((cur) => cur.map((s) => (s.id === id ? applyReview(s, req, at) : s)));
      setFixtureAudit((cur) => ({
        ...cur,
        [id]: [...(cur[id] ?? []), { id: `${id}-${at}`, sessionId: id, at, actor: "clinician", actorId: reviewer, type: "pharmacy_review", payload: { ...req } }],
      }));
      return;
    }
    await post(`/api/sessions/${id}/pharmacy-review`, req);
    refresh();
  }, [reviewer, refresh]);

  const usingFixtures = entries?.some((e) => e.fixture) ?? false;

  return (
    <C.Provider value={{ lang, setLang, reviewer, setReviewer, now, entries, error, refresh, submit, fixtureAudit }}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b border-rule px-4 min-[1280px]:px-6">
          <Link href="/" className="font-serif text-lead font-medium">MedX Bridge</Link>
          <Link href="/pharmacy" className="text-small text-ink-soft underline-offset-4 hover:underline">Pharmacy reconciliation</Link>
          {usingFixtures && <Badge tone="pencil">Fixture data</Badge>}
          <div className="ml-auto flex items-center gap-4">
            <label className="flex items-center gap-2 text-small text-ink-soft">
              <span className="hidden min-[1100px]:inline">Signed in as</span>
              <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="h-8 rounded-control border border-rule-strong bg-sheet px-2 text-small text-ink" aria-label="Signed in as">
                {PHARMACISTS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <div role="radiogroup" aria-label="Clinician language" className="flex overflow-hidden rounded-control border border-rule-strong">
              {LANG_OPTIONS.map((o) => (
                <button
                  key={o.lang} type="button" role="radio" aria-checked={lang === o.lang} lang={o.lang} onClick={() => setLang(o.lang)}
                  className={`h-8 px-3 text-small font-medium transition-colors duration-quick ease-pen ${lang === o.lang ? "bg-ink text-sheet" : "bg-sheet text-ink hover:bg-paper"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4 min-[1280px]:px-6 min-[1280px]:pb-6">{children}</main>
      </div>
    </C.Provider>
  );
}
