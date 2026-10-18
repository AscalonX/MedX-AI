"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ConsultMode, IntakeSession, Lang, Localized } from "@medx/shared";
import { Icon, type IconName } from "@/components/ui";
import { useFrame } from "../(clinician)/_frame";
import { StageChip } from "./StageChip";

export type CaseTab = "summary" | "consult" | "vitals" | "orders" | "trace";
const TABS: CaseTab[] = ["summary", "consult", "vitals", "orders", "trace"];
const L = (en: string, th: string, it: string): Localized => ({ en, th, it });
/** Thai and Italian need native-speaker review. */
const LABEL: Record<CaseTab | "nav", Localized> = {
  nav: L("Case pages", "หน้าของเคส", "Pagine del caso"),
  summary: L("Case", "เคส", "Caso"),
  consult: L("Consult", "การสอบถาม", "Consulto"),
  vitals: L("Vitals", "สัญญาณชีพ", "Parametri vitali"),
  orders: L("Orders", "คำสั่งการรักษา", "Ordini"),
  trace: L("Case trace", "เส้นทางของเคส", "Traccia del caso"),
};
const ICON: Record<CaseTab, IconName> = { summary: "clipboard-list", consult: "mic", vitals: "activity", orders: "pill", trace: "route" };
const LANG_NAME: Record<Lang, string> = { th: "ไทย", it: "Italiano", en: "English" };

export function caseHref(id: string, tab: CaseTab, mode: ConsultMode): string {
  const base = `/review/${encodeURIComponent(id)}`;
  return tab === "summary" ? base : tab === "consult" ? `${base}/consult?mode=${mode}` : `${base}/${tab}`;
}

/** One row of pill tabs between the pages of a case, so every page of the visit is one tap away. */
export function CaseNav({ id, active, lang, mode, className = "" }: { id: string; active: CaseTab; lang: Lang; mode: ConsultMode; className?: string }) {
  return (
    <nav aria-label={LABEL.nav[lang]} className={`max-w-full overflow-x-auto ${className}`}>
      <ul className="inline-flex gap-0.5 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <li key={t}>
            <Link
              href={caseHref(id, t, mode)}
              aria-current={active === t ? "page" : undefined}
              data-case-tab={t}
              className={[
                "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-small font-semibold transition-[background-color,color,box-shadow] duration-base ease-pen",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean",
                active === t ? "bg-sheet text-ink shadow-hairline ring-1 ring-rule/70" : "text-ink-soft hover:bg-sheet/60 hover:text-ink",
              ].join(" ")}
            >
              <Icon name={ICON[t]} size={14} />
              {LABEL[t][lang]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Header for the pages of one case (consult, vitals, orders, trace): case tabs, the page title, the patient code,
 * the patient's language and the journey stage chip, with optional badges and actions on the right.
 */
export function CaseHeader({ id, active, title, lang, session, mode, badges, actions, children }: {
  id: string;
  active: CaseTab;
  title: ReactNode;
  lang: Lang;
  session: IntakeSession | null;
  /** Consult mode for the Consult tab; defaults to the current clinician role. */
  mode?: ConsultMode;
  badges?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { rows, clinicianRole } = useFrame();
  const row = rows?.find((r) => r.id === id);
  return (
    <header className="cl-enter mb-5 flex flex-col gap-4">
      <CaseNav id={id} active={active} lang={lang} mode={mode ?? clinicianRole} />
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-title font-extrabold text-ink">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {session ? (
              <span className="inline-flex h-6 items-center rounded-full bg-ink px-2.5 text-micro font-bold tabular-nums text-sheet">{session.code}</span>
            ) : (
              <span aria-hidden="true" className="mx-skeleton !h-6 !w-16 !rounded-full" />
            )}
            {session && (
              <span lang={session.patientLang} className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-micro font-semibold text-ink-soft">
                {LANG_NAME[session.patientLang]}
              </span>
            )}
            {row?.stage && <StageChip s={row} stage={row.stage} lang={lang} />}
            {badges}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
