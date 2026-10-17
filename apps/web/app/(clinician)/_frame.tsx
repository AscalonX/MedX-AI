"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "@medx/shared";
import { AppShell, Icon, type ShellRole } from "@/components/ui";
import { REVIEWERS } from "./review/_lib";
import { tr } from "./review/_i18n";

interface Frame { clinicianRole: "nurse" | "doctor"; setClinicianRole: (r: "nurse" | "doctor") => void; lang: Lang; setLang: (l: Lang) => void; reviewer: string; setReviewer: (r: string) => void; now: number }
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

// Soft card enter. Reduced motion is flattened by the global rule in globals.css.
const ENTER_CSS =
  "@keyframes cl-enter{from{opacity:0;transform:translateY(8px)}}.cl-enter{animation:cl-enter 240ms var(--ease-pen) both}" +
  "@keyframes cl-slide{0%{opacity:0;transform:translateY(-18px);box-shadow:0 0 0 0 rgba(190,27,43,.55)}60%{opacity:1;transform:none;box-shadow:0 0 0 6px rgba(190,27,43,.35)}100%{box-shadow:0 0 0 0 rgba(190,27,43,0)}}.cl-slide{animation:cl-slide 420ms var(--ease-interrupt) both}";

/** App shell for clinician surfaces: language and reviewer state, greeting, role switch, nav. */
export function ClinicianFrame({ active, urgent, children }: { active: "home" | "review"; urgent?: number; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [reviewer, setReviewerState] = useState(REVIEWERS[0]);
  const [now, setNow] = useState(0);
  const [clinicianRole, setClinicianRole] = useState<"nurse" | "doctor">("nurse");
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    const l = store.get("medx.lang");
    if (l === "th" || l === "it" || l === "en") setLangState(l);
    const r = store.get("medx.reviewer");
    if (r && REVIEWERS.includes(r)) setReviewerState(r);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const setLang = (l: Lang) => { setLangState(l); store.set("medx.lang", l); };
  const setReviewer = (r: string) => { setReviewerState(r); store.set("medx.reviewer", r); };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const hour = now ? new Date(now).getHours() : -1;
  const greeting = tr(hour < 0 ? "hello" : hour < 12 ? "greetMorning" : hour < 18 ? "greetAfternoon" : "greetEvening", lang);
  const role: ShellRole = path?.startsWith("/pharmacy") ? "pharmacist" : path?.startsWith("/ops") ? "ops" : clinicianRole;
  const switchRole = (r: ShellRole) => {
    if (r === "pharmacist") router.push("/pharmacy");
    else if (r === "ops") router.push("/ops");
    else { setClinicianRole(r); if (active === "home" || !path?.startsWith("/review")) router.push("/review"); }
  };

  return (
    <F.Provider value={{ clinicianRole, setClinicianRole, lang, setLang, reviewer, setReviewer, now }}>
      <style>{ENTER_CSS}</style>
      <a href="#main-content" className="sr-only z-50 rounded-full bg-sheet px-4 py-2 text-small font-semibold text-ocean focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        {tr("skip", lang)}
      </a>
      <AppShell
        role={role}
        onRoleChange={switchRole}
        nav={[
          { href: "/", label: tr("navHome", lang), icon: <Icon name="home" />, active: active === "home" },
          { href: "/review", label: tr("navQueue", lang), icon: <Icon name="clipboard-list" />, active: active === "review", alert: urgent || undefined },
          { href: "/pharmacy", label: tr("navPharmacy", lang), icon: <Icon name="pill" /> },
          { href: "/ops", label: tr("navOps", lang), icon: <Icon name="activity" /> },
        ]}
        greeting={greeting}
        userName={reviewer}
        lang={lang}
        onLangChange={setLang}
        actions={
          <label className="flex items-center gap-2 text-small text-ink-soft">
            <span className="sr-only min-[1100px]:not-sr-only">{tr("signedInAs", lang)}</span>
            <select
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="h-9 rounded-full border border-rule-strong/60 bg-sheet px-3 text-small font-semibold text-ink"
              aria-label={tr("signedInAs", lang)}
            >
              {REVIEWERS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        }
      >
        <div id="main-content" tabIndex={-1} className="outline-none">{children}</div>
      </AppShell>
    </F.Provider>
  );
}
