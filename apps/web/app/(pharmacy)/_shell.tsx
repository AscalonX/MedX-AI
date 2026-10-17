"use client";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuditEvent, IntakeSession, Lang, PharmacyReviewReq } from "@medx/shared";
import { AppShell, Badge, Icon, type ShellRole } from "@/components/ui";
import { FIXTURES } from "./_fixtures";
import { L, PHARMACISTS, applyReview, fetchQueue, hasMedData, openFlags, openHigh, post, sortQueue } from "./_lib";

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
  const [forceFix, setForceFix] = useState(false); // ?fixtures=1 shows fixtures next to live data's absence for demos/tests
  const [fixtureAudit, setFixtureAudit] = useState<Record<string, AuditEvent[]>>({});
  const fixturesRef = useRef(fixtures);
  fixturesRef.current = fixtures;

  useEffect(() => {
    const l = store.get("medx.lang");
    if (l === "th" || l === "it" || l === "en") setLangState(l);
    const r = store.get("medx.pharmacist");
    if (r && PHARMACISTS.includes(r)) setReviewerState(r);
    setFixtures(FIXTURES);
    setForceFix(new URLSearchParams(window.location.search).has("fixtures")); // after mount: fixture timestamps are computed per page load
  }, []);
  const setLang = (l: Lang) => { setLangState(l); store.set("medx.lang", l); };
  const setReviewer = (r: string) => { setReviewerState(r); store.set("medx.pharmacist", r); };

  // Generation counter: a GET that started before a newer GET or a POST must not overwrite fresher data.
  const gen = useRef(0);
  const refresh = useCallback(() => {
    const g = ++gen.current;
    fetchQueue()
      .then((q) => { if (g === gen.current) { setLive(q); setError(null); } })
      .catch((e: Error) => { if (g === gen.current) { setLive((cur) => cur ?? []); setError(e.message); } });
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
    if (real.length && !forceFix) return sortQueue(real.map((e) => e.session)).map((s) => ({ session: s, fixture: false }));
    return sortQueue(fixtures).map((session) => ({ session, fixture: true }));
  }, [live, fixtures, forceFix]);

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
    gen.current++; // drop any poll already in flight
    try {
      const updated = await post<IntakeSession>(`/api/sessions/${id}/pharmacy-review`, req);
      setLive((cur) => (cur ? cur.map((s) => (s.id === id ? updated : s)) : cur));
    } catch (e) {
      refresh(); // reload the real state before the controls unlock
      throw e;
    }
  }, [reviewer, refresh]);

  const usingFixtures = entries?.some((e) => e.fixture) ?? false;
  const urgent = (entries ?? []).reduce((n, e) => n + openHigh(e.session).length + openFlags(e.session).length, 0);
  const hour = now ? new Date(now).getHours() : 12;
  const greeting = (hour < 12 ? L("สวัสดีตอนเช้า", "Buongiorno", "Good morning") : hour < 18 ? L("สวัสดีตอนบ่าย", "Buon pomeriggio", "Good afternoon") : L("สวัสดีตอนเย็น", "Buonasera", "Good evening"))[lang];
  const router = useRouter();
  const switchRole = (r: ShellRole) => { if (r === "ops") router.push("/ops"); else if (r !== "pharmacist") router.push("/review"); };

  return (
    <C.Provider value={{ lang, setLang, reviewer, setReviewer, now, entries, error, refresh, submit, fixtureAudit }}>
      <AppShell
        role="pharmacist"
        onRoleChange={switchRole}
        nav={[{ href: "/pharmacy", label: "Reconciliation queue", icon: <Icon name="pill" />, active: true, alert: urgent || undefined }]}
        greeting={greeting}
        userName={reviewer}
        lang={lang}
        onLangChange={setLang}
        actions={
          <>
            {usingFixtures && <Badge tone="pencil">Fixture data</Badge>}
            <label className="flex items-center gap-2 text-small text-ink-soft">
              <span className="sr-only min-[1100px]:not-sr-only">Signed in as</span>
              <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="h-9 rounded-full border border-rule-strong/60 bg-sheet px-3 text-small font-semibold text-ink" aria-label="Signed in as">
                {PHARMACISTS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </>
        }
      >
        {children}
      </AppShell>
    </C.Provider>
  );
}
