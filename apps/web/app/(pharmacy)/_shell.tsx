"use client";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuditEvent, AuditType, DispenseChecklist, DispenseOrderReq, IntakeSession, Lang, PharmacistReport, PharmacyOrderActionReq, PharmacyReviewReq, PickupReq } from "@medx/shared";
import { AppShell, Badge, Icon, shellLabels, type ShellRole } from "@/components/ui";
import { FIXTURES } from "./_fixtures";
import { ROLE_STORAGE_KEY, reviewerStorageKey } from "@medx/shared";
import { L, PHARMACISTS, setDisplayLang, applyDispense, applyOrderAction, applyPickup, applyReview, collectedOrderIds, fetchQueue, hasMedData, hasOrders, newlyDispensed, openFlags, openHigh, post, sortQueue, C as CH } from "./_lib";
import { startVisiblePolling } from "../_shared/visiblePolling";
import { AccountMenu } from "../_shared/AccountMenu";
import { DemoGuide } from "../_shared/DemoGuide";
import { IdentityGate, SignInSheet, useIdentityGate } from "../_shared/SignIn";
import { at, signOut } from "../_shared/identity";

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
  /** Pharmacist 1: verify, or return to the prescriber with a note and an optional report. */
  submitOrder: (sessionId: string, orderId: string, action: "verify" | "return", note?: string, report?: PharmacistReport) => Promise<void>;
  /** Pharmacist 2: final check and dispense. The server refuses the pharmacist who verified the order. */
  dispense: (sessionId: string, orderId: string, checklist: DispenseChecklist, note?: string) => Promise<void>;
  /** Call the patient to a counter, or record that the medicines were collected. */
  pickup: (sessionId: string, action: PickupReq["action"], counter?: string) => Promise<void>;
  /** Locally recorded audit events for fixture sessions. */
  fixtureAudit: Record<string, AuditEvent[]>;
  /** Sessions that arrived after the first load; rows highlight them once (a few seconds). */
  fresh: ReadonlySet<string>;
}
const C = createContext<Ctx | null>(null);
/** Exposed for render harnesses that provide the context without the Next router. */
export const PharmacyContext = C;
export type PharmacyCtx = Ctx;
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
  const fixtureAuditRef = useRef(fixtureAudit);
  fixtureAuditRef.current = fixtureAudit;
  // New-arrival highlight (C-04): ids seen so far; anything new after the first load is "fresh" for a few seconds.
  const seen = useRef<Set<string> | null>(null);
  const loadedOnce = useRef(false); // the baseline is the first successful load, not an error placeholder
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const freshTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const l = store.get("medx.lang");
    if (l === "th" || l === "it" || l === "en") setLangState(l);
    const r = store.get(reviewerStorageKey("pharmacist"));
    if (r && PHARMACISTS.includes(r)) setReviewerState(r);
    store.set(ROLE_STORAGE_KEY, "pharmacist"); // this surface owns the role while it is open
    setFixtures(FIXTURES);
    setForceFix(new URLSearchParams(window.location.search).has("fixtures")); // after mount: fixture timestamps are computed per page load
  }, []);
  const setLang = (l: Lang) => { setLangState(l); store.set("medx.lang", l); };
  // Sign-in gate (w20): no stored pharmacist identity -> "Who's signing in?" before any write.
  const gate = useIdentityGate("pharmacist");
  const [nudge, setNudge] = useState(0);
  const blockedControl = useRef<HTMLElement | null>(null);
  const signedInRef = useRef(false);
  signedInRef.current = gate.signedIn;
  const langRef = useRef(lang);
  langRef.current = lang;
  const setReviewer = (r: string) => { setReviewerState(r); store.set(reviewerStorageKey("pharmacist"), r); gate.confirm("pharmacist"); };
  /** Second line of defence behind the page gate: no write leaves this shell before someone has signed in. */
  const requireIdentity = useCallback(() => {
    if (signedInRef.current) return;
    setNudge((n) => n + 1);
    throw new Error(at("sheetBlocked", langRef.current));
  }, []);

  // Polls are single-flight, suspended during mutations, and every GET that started before a mutation
  // began or finished is discarded by the generation counter.
  const gen = useRef(0);
  const inflight = useRef(false);
  const mutating = useRef(0);
  const refresh = useCallback(() => {
    if (mutating.current > 0 || inflight.current) return;
    const g = ++gen.current;
    inflight.current = true;
    fetchQueue()
      .then((q) => { if (g === gen.current) { loadedOnce.current = true; setLive(q); setError(null); } })
      .catch((e: Error) => { if (g === gen.current) { setLive((cur) => cur ?? []); setError(e.message); } })
      .finally(() => { inflight.current = false; });
  }, []);
  // Paused while the tab is hidden (no /api/sessions traffic from a background tab); resumes at once when visible.
  useEffect(() => startVisiblePolling(() => { refresh(); setNow(Date.now()); }, 5000), [refresh]);

  useEffect(() => {
    if (live === null) return;
    // "New" means newly in the pharmacy queue (it now carries medicines or orders), not newly created.
    const ids = live.filter((s) => hasMedData(s) || hasOrders(s)).map((s) => s.id);
    if (seen.current === null) { if (loadedOnce.current) seen.current = new Set(ids); return; } // first load: nothing is "new"
    const added = ids.filter((id) => !seen.current!.has(id));
    if (!added.length) return;
    for (const id of added) seen.current.add(id);
    setFresh((cur) => new Set([...cur, ...added]));
    // Not cleared on the next poll (that would leave the highlight on forever); only on unmount.
    freshTimers.current.push(setTimeout(() => setFresh((cur) => { const n = new Set(cur); for (const id of added) n.delete(id); return n; }), 4000));
  }, [live]);
  useEffect(() => {
    const timers = freshTimers.current; // the same array the arrivals push into
    return () => { for (const t of timers) clearTimeout(t); };
  }, []);

  // Live sessions that carry medication data win. Fixtures appear only when there are none.
  const entries = useMemo<Entry[] | null>(() => {
    if (live === null) return null;
    // The queue could not be read yet (e.g. 503 "Shared store unavailable"): keep loading and show the error line,
    // never sample data in place of real cases. ?fixtures=1 still shows the fixtures on purpose.
    if (!loadedOnce.current && !forceFix) return null;
    const real = live.filter((x) => hasMedData(x) || hasOrders(x)).map((session) => ({ session, fixture: false }));
    if (real.length && !forceFix) return sortQueue(real.map((e) => e.session)).map((s) => ({ session: s, fixture: false }));
    return sortQueue(fixtures).map((session) => ({ session, fixture: true }));
  }, [live, fixtures, forceFix]);

  const submit = useCallback<Submit>(async (id, body) => {
    requireIdentity();
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
    mutating.current++; gen.current++; // suspend polling, invalidate outstanding GETs
    let failed = false;
    try {
      const updated = await post<IntakeSession>(`/api/sessions/${id}/pharmacy-review`, req);
      setLive((cur) => (cur ? cur.map((s) => (s.id === id ? updated : s)) : cur));
    } catch (e) {
      failed = true;
      throw e;
    } finally {
      mutating.current--; gen.current++; // GETs that raced the POST must not overwrite its result
      if (failed) refresh(); // reload the real state before the controls unlock
    }
  }, [reviewer, refresh, requireIdentity]);

  setDisplayLang(lang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  /**
   * One write path for every order and pickup action. Fixture sessions apply the same rules locally (throwing the
   * server's message on refusal) and record a local audit event; live sessions POST and take the returned session.
   */
  const mutate = useCallback(async (
    sessionId: string, url: string, body: unknown, local: (s: IntakeSession, at: string) => IntakeSession, audit: { type: AuditType; payload: Record<string, unknown> },
  ) => {
    requireIdentity();
    const fx = fixturesRef.current.find((x) => x.id === sessionId);
    if (fx) {
      const at = new Date().toISOString();
      const next = local(fx, at); // throws with the server's wording when the rule refuses
      fixturesRef.current = fixturesRef.current.map((x) => (x.id === sessionId ? next : x));
      setFixtures(fixturesRef.current);
      setFixtureAudit((cur) => ({ ...cur, [sessionId]: [...(cur[sessionId] ?? []), { id: `${sessionId}-${audit.type}-${at}`, sessionId, at, actor: "clinician", actorId: reviewer, type: audit.type, payload: audit.payload }] }));
      return;
    }
    mutating.current++; gen.current++;
    let failed = false;
    try {
      const res = await post<unknown>(url, body);
      const updated = res as IntakeSession | null;
      if (updated && typeof updated === "object" && updated.id === sessionId) setLive((cur) => (cur ? cur.map((x) => (x.id === sessionId ? updated : x)) : cur));
      else failed = true; // unknown response shape: reload
    } catch (e) { failed = true; throw e; }
    finally { mutating.current--; gen.current++; if (failed) refresh(); }
  }, [reviewer, refresh, requireIdentity]);

  const submitOrder = useCallback<Ctx["submitOrder"]>((sessionId, orderId, action, note, report) => {
    // The report travels only with a return; verify sends no alert ids or suggestions.
    const req: PharmacyOrderActionReq = { reviewerId: reviewer, action, ...(note ? { note } : {}), ...(action === "return" && report ? { alertIds: report.alertIds, suggestedGenerics: report.suggestedGenerics } : {}) };
    return mutate(sessionId, `/api/sessions/${sessionId}/orders/medications/${orderId}/pharmacy`, req,
      (s, at) => applyOrderAction(s, orderId, req, at), { type: "order_pharmacy_action", payload: { orderId, ...req } });
  }, [reviewer, mutate]);

  const dispense = useCallback<Ctx["dispense"]>((sessionId, orderId, checklist, note) => {
    const req: DispenseOrderReq = { reviewerId: reviewer, checklist, ...(note ? { note } : {}) };
    return mutate(sessionId, `/api/sessions/${sessionId}/orders/medications/${orderId}/dispense`, req,
      (s, at) => applyDispense(s, orderId, req, at), { type: "order_dispensed", payload: { orderId, ...req } });
  }, [reviewer, mutate]);

  const pickup = useCallback<Ctx["pickup"]>((sessionId, action, counter) => {
    const req: PickupReq = { reviewerId: reviewer, action, ...(action === "call" && counter ? { counter } : {}) };
    const fx = fixturesRef.current.find((x) => x.id === sessionId);
    // Fixture mirror of the engine's pickup cycles: orders collected earlier come from the local audit.
    const collected = collectedOrderIds(fixtureAuditRef.current[sessionId]);
    const orderIds = fx ? newlyDispensed(fx, collected).map((o) => o.id) : [];
    const recall = fx?.pickup?.status === "ready";
    return mutate(sessionId, `/api/sessions/${sessionId}/pickup`, req,
      (s, at) => applyPickup(s, req, at, collected),
      { type: action === "call" ? "pickup_called" : "pickup_collected", payload: { ...req, orderIds, ...(action === "call" ? { recall } : {}) } });
  }, [reviewer, mutate]);

  const usingFixtures = entries?.some((e) => e.fixture) ?? false;
  const urgent = (entries ?? []).reduce((n, e) => n + openHigh(e.session).length + openFlags(e.session).length, 0);
  const hour = now ? new Date(now).getHours() : 12;
  const greeting = (hour < 12 ? L("สวัสดีตอนเช้า", "Buongiorno", "Good morning") : hour < 18 ? L("สวัสดีตอนบ่าย", "Buon pomeriggio", "Good afternoon") : L("สวัสดีตอนเย็น", "Buonasera", "Good evening"))[lang];
  const router = useRouter();
  const switchRole = (r: ShellRole) => { store.set(ROLE_STORAGE_KEY, r); if (r === "ops") router.push("/ops"); else if (r !== "pharmacist") router.push("/review"); };
  const chooseIdentity = (r: string) => {
    setReviewer(r);
    const back = blockedControl.current;
    blockedControl.current = null;
    if (back?.isConnected) setTimeout(() => back.focus({ preventScroll: true }), 0);
  };
  const roleName = shellLabels[lang].roles.pharmacist;

  return (
    <C.Provider value={{ lang, setLang, reviewer, setReviewer, now, entries, error, refresh, submit, submitOrder, dispense, pickup, fixtureAudit, fresh }}>
      <AppShell
        role="pharmacist"
        onRoleChange={switchRole}
        nav={[{ href: "/pharmacy", label: CH.pharmacyQueue[lang], icon: <Icon name="pill" />, active: true, alert: urgent || undefined }]}
        greeting={greeting}
        userName={gate.needed ? at("notSignedIn", lang) : reviewer}
        lang={lang}
        onLangChange={setLang}
        account={
          <AccountMenu
            name={reviewer}
            roleLabel={roleName}
            signedIn={!gate.needed}
            lang={lang}
            onSignOut={() => router.push(signOut().href)}
            onSignIn={() => setNudge((n) => n + 1)}
          />
        }
        actions={
          <>
            {usingFixtures && <Badge tone="pencil">{CH.fixture[lang]}</Badge>}
            <label className="flex items-center gap-2 text-small text-ink-soft">
              <span className="sr-only min-[1100px]:not-sr-only">{CH.signedInAs[lang]}</span>
              <select value={gate.needed ? "" : reviewer} onChange={(e) => setReviewer(e.target.value)} className="h-9 rounded-full border border-rule-strong/60 bg-sheet px-3 text-small font-semibold text-ink" aria-label={CH.signedInAs[lang]}>
                {gate.needed && <option value="" disabled>{at("choosePlaceholder", lang)}</option>}
                {PHARMACISTS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </>
        }
      >
        <IdentityGate blocked={gate.needed} onBlocked={(c) => { blockedControl.current = c; setNudge((n) => n + 1); }}>
          {/* Demo guide (M-06): renders only when a demo persona was chosen on the landing page. Neutral, no Fin, no red. */}
          <DemoGuide
            lang={lang} role="pharmacist" userName={reviewer} rows={live} className="mb-6"
            onApply={(p) => { if (p.role === "pharmacist" && p.staffName && PHARMACISTS.includes(p.staffName)) setReviewer(p.staffName); }}
          />
          {children}
        </IdentityGate>
        <SignInSheet open={gate.needed} lang={lang} role="pharmacist" roleLabel={roleName} onChoose={chooseIdentity} nudge={nudge} />
      </AppShell>
    </C.Provider>
  );
}
