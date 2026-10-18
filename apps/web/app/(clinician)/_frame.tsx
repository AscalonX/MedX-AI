"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { DemoPersona, Lang, SessionListItem } from "@medx/shared";
import { AppShell, Icon, SegmentedControl, shellLabels, type ShellRole } from "@/components/ui";
import { reviewerStorageKey } from "@medx/shared/src/staff";
import { AccountMenu } from "../_shared/AccountMenu";
import { DemoGuide } from "../_shared/DemoGuide";
import { IdentityGate, SignInSheet, useIdentityGate } from "../_shared/SignIn";
import { at, signOut } from "../_shared/identity";
import { onCaseChanged } from "../_shared/caseEvents";
import { useStaffRole } from "../_shared/useStaffRole";
import { useVisiblePolling } from "../_shared/visiblePolling";
import { fetchQueue, reviewersFor, unreviewed } from "./review/_lib";
import { tr } from "./review/_i18n";

/** Which nav item is current. "home" is kept for the earlier app home; the nav's Home now opens /demo. */
export type FrameActive = "home" | "demo" | "review";

interface Frame {
  clinicianRole: "nurse" | "doctor";
  setClinicianRole: (r: "nurse" | "doctor") => void;
  restored: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  reviewer: string;
  setReviewer: (r: string) => void;
  /** true once someone chose (or had stored) an identity for the current role; writes are gated until then. */
  signedIn: boolean;
  now: number;
  /** GET /api/sessions rows with their journey `stage`; null until the first load. */
  rows: SessionListItem[] | null;
}
const F = createContext<Frame | null>(null);
export const useFrame = () => {
  const c = useContext(F);
  if (!c) throw new Error("useFrame outside ClinicianFrame");
  return c;
};

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: keep in memory only */ } },
};

// Soft card enter, the red slide-in for a new emergency, and a one-time ocean ring for a newly arrived case.
// Colours come from the tokens. Reduced motion is flattened by the global rule in globals.css.
const ENTER_CSS =
  "@keyframes cl-enter{from{opacity:0;transform:translateY(8px)}}.cl-enter{animation:cl-enter 240ms var(--ease-pen) both}" +
  "@keyframes cl-slide{0%{opacity:0;transform:translateY(-18px);box-shadow:0 0 0 0 color-mix(in srgb,var(--color-signal) 55%,transparent)}60%{opacity:1;transform:none;box-shadow:0 0 0 6px color-mix(in srgb,var(--color-signal) 35%,transparent)}100%{box-shadow:0 0 0 0 transparent}}.cl-slide{animation:cl-slide 420ms var(--ease-interrupt) both}" +
  "@keyframes cl-new{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--color-ocean) 45%,transparent)}45%{box-shadow:0 0 0 6px color-mix(in srgb,var(--color-ocean) 22%,transparent)}100%{box-shadow:0 0 0 0 transparent}}.cl-new>a{animation:cl-new 1600ms var(--ease-pen) 1 both}" +
  // The case workspace fills the viewport; with the demo guide bar above it, it gives that height back.
  "main:has([data-demo-guide]) .cl-workspace{height:calc(100dvh - 14.5rem)}";

/**
 * App shell for clinician surfaces: language and reviewer state, greeting, role switch, nav, and the demo guide.
 * `rows`: the queue a parent already polls (the review Shell). Without it, case pages load the rows themselves,
 * slowly and only while the tab is visible, for the stage chip, the guide and the urgent count.
 */
export function ClinicianFrame({ active, urgent, rows, children }: { active: FrameActive; urgent?: number; rows?: SessionListItem[] | null; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [reviewer, setReviewerState] = useState(reviewersFor("nurse")[0]);
  const [now, setNow] = useState(0);
  const [ownRows, setOwnRows] = useState<SessionListItem[] | null>(null);
  const { role: clinicianRole, setRole: setClinicianRole, restored } = useStaffRole();
  const router = useRouter();
  const path = usePathname();
  // Sign-in gate (w20): no stored identity for this role -> "Who's signing in?" before any write.
  const gate = useIdentityGate(clinicianRole, restored);
  const [nudge, setNudge] = useState(0);
  const blockedControl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const l = store.get("medx.lang");
    if (l === "th" || l === "it" || l === "en") setLangState(l);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const setLang = (l: Lang) => { setLangState(l); store.set("medx.lang", l); };
  const setReviewer = (r: string) => { setReviewerState(r); store.set(reviewerStorageKey(clinicianRole), r); gate.confirm(clinicianRole); };
  // The sheet sets the identity exactly like the "Signed in as" select, then hands focus back to the blocked control.
  const chooseIdentity = (r: string) => {
    setReviewer(r);
    const back = blockedControl.current;
    blockedControl.current = null;
    if (back?.isConnected) setTimeout(() => back.focus({ preventScroll: true }), 0);
  };
  const onBlocked = (c: HTMLElement | null) => { blockedControl.current = c; setNudge((n) => n + 1); };
  const signOutNow = () => { router.push(signOut().href); };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // The identity list follows the role and is remembered per role (nurse names in nurse mode, doctors in doctor mode).
  const names = reviewersFor(clinicianRole);
  useEffect(() => {
    const saved = store.get(reviewerStorageKey(clinicianRole));
    setReviewerState(saved && reviewersFor(clinicianRole).includes(saved) ? saved : reviewersFor(clinicianRole)[0]);
  }, [clinicianRole]);

  // Case pages outside the review Shell (vitals, orders, trace) poll the rows themselves.
  const own = rows === undefined && active === "review";
  const loadRows = useCallback(() => { fetchQueue().then(setOwnRows).catch(() => { /* keep the last rows; the page shows its own errors */ }); }, []);
  useVisiblePolling(loadRows, 15000, null, own);
  useEffect(() => (own ? onCaseChanged(() => loadRows()) : undefined), [own, loadRows]);
  const list = rows === undefined ? ownRows : rows;
  const urgentCount = urgent ?? list?.filter((s) => s.status === "escalated" && unreviewed(s.summary?.redFlags ?? []).length > 0).length;

  const hour = now ? new Date(now).getHours() : -1;
  const greeting = tr(hour < 0 ? "hello" : hour < 12 ? "greetMorning" : hour < 18 ? "greetAfternoon" : "greetEvening", lang);
  const role: ShellRole = path?.startsWith("/pharmacy") ? "pharmacist" : path?.startsWith("/ops") ? "ops" : clinicianRole;
  const switchRole = (r: ShellRole) => {
    if (r === "pharmacist" || r === "ops") { try { localStorage.setItem("medx.role", r); } catch { /* storage blocked */ } router.push(r === "pharmacist" ? "/pharmacy" : "/ops"); }
    else { setClinicianRole(r); if (active !== "review" || !path?.startsWith("/review")) router.push("/review"); }
  };
  // The guide's "Reset my demo case" already stored the persona's role and name; mirror them in memory.
  const applyPersona = (p: DemoPersona) => {
    if (p.role !== "nurse" && p.role !== "doctor") return;
    setClinicianRole(p.role);
    if (p.staffName) { setReviewerState(p.staffName); gate.confirm(p.role); }
  };
  const signedIn = gate.signedIn;
  const roleNames = shellLabels[lang].roles;

  return (
    <F.Provider value={{ clinicianRole, setClinicianRole, restored, lang, setLang, reviewer, setReviewer, signedIn, now, rows: list }}>
      <style>{ENTER_CSS}</style>
      <AppShell
        account={
          <AccountMenu
            name={reviewer}
            roleLabel={roleNames[clinicianRole]}
            signedIn={!gate.needed}
            lang={lang}
            onSignOut={signOutNow}
            onSignIn={() => setNudge((n) => n + 1)}
          />
        }
        role={role}
        onRoleChange={switchRole}
        nav={[
          { href: "/demo", label: tr("navHome", lang), icon: <Icon name="home" />, active: active === "home" || active === "demo" },
          { href: "/review", label: tr("navQueue", lang), icon: <Icon name="clipboard-list" />, active: active === "review", alert: urgentCount || undefined },
          { href: "/pharmacy", label: tr("navPharmacy", lang), icon: <Icon name="pill" /> },
          { href: "/ops", label: tr("navOps", lang), icon: <Icon name="activity" /> },
        ]}
        greeting={greeting}
        userName={gate.needed ? at("notSignedIn", lang) : reviewer}
        lang={lang}
        onLangChange={setLang}
        actions={
          <label className="flex items-center gap-2 text-small text-ink-soft">
            <span className="sr-only min-[1100px]:not-sr-only">{tr("signedInAs", lang)}</span>
            <select
              value={gate.needed ? "" : reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="h-9 rounded-full border border-rule-strong/60 bg-sheet px-3 text-small font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
              aria-label={tr("signedInAs", lang)}
            >
              {gate.needed && <option value="" disabled>{at("choosePlaceholder", lang)}</option>}
              {names.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        }
      >
        <IdentityGate blocked={gate.needed} onBlocked={onBlocked}>
          {active === "review" && <DemoGuide lang={lang} role={clinicianRole} userName={reviewer} rows={list} onApply={applyPersona} className="mx-auto mb-5 max-w-[1440px]" />}
          {children}
        </IdentityGate>
        <SignInSheet
          open={gate.needed}
          lang={lang}
          role={clinicianRole}
          roleLabel={roleNames[clinicianRole]}
          onChoose={chooseIdentity}
          nudge={nudge}
          roleSwitch={
            <SegmentedControl
              ariaLabel={shellLabels[lang].roleGroup}
              size="sm"
              activation="manual"
              value={clinicianRole}
              onChange={(r) => switchRole(r)}
              options={(["nurse", "doctor"] as const).map((r) => ({ value: r, label: roleNames[r] }))}
            />
          }
        />
      </AppShell>
    </F.Provider>
  );
}
