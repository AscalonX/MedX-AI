"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import type { Lang } from "@medx/shared";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";
import { SegmentedControl } from "./SegmentedControl";
import { cx } from "./cx";

export type ShellRole = "nurse" | "doctor" | "pharmacist" | "ops";
export interface ShellNavItem {
  href: string;
  label: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  /** Urgent count, shown in red. Only for things that need action now. */
  alert?: number;
}

export interface ShellLabels {
  roles: Record<ShellRole, string>;
  roleGroup: string;
  language: string;
  nav: string;
  skip: string;
  disclaimer: string;
}

/** Built-in chrome copy. Pages may override any string with `labels` (native-speaker review pending for th/it). */
export const shellLabels: Record<Lang, ShellLabels> = {
  en: {
    roles: { nurse: "Nurse", doctor: "Doctor", pharmacist: "Pharmacist", ops: "Ops" },
    roleGroup: "Role",
    language: "Language",
    nav: "Main",
    skip: "Skip to content",
    disclaimer: "Research prototype. Supports clinicians; does not diagnose.",
  },
  it: {
    roles: { nurse: "Infermiere", doctor: "Medico", pharmacist: "Farmacista", ops: "Gestione" },
    roleGroup: "Ruolo",
    language: "Lingua",
    nav: "Principale",
    skip: "Vai al contenuto",
    disclaimer: "Prototipo di ricerca. Supporta i clinici; non fa diagnosi.",
  },
  th: {
    roles: { nurse: "พยาบาล", doctor: "แพทย์", pharmacist: "เภสัชกร", ops: "ปฏิบัติการ" },
    roleGroup: "บทบาท",
    language: "ภาษา",
    nav: "เมนูหลัก",
    skip: "ข้ามไปยังเนื้อหา",
    disclaimer: "ต้นแบบเพื่อการวิจัย ช่วยสนับสนุนแพทย์ ไม่ใช่การวินิจฉัย",
  },
};

const langLabel: Record<Lang, string> = { th: "ไทย", it: "IT", en: "EN" };

/**
 * Web app shell (DIRECTION.md 8.2): left sidebar (brand, role switch, nav), top bar (greeting, language pill, avatar
 * or the `account` menu).
 * Below 1024px the sidebar becomes a top bar with horizontal nav. No business logic: the page owns role and language.
 */
export function AppShell({
  nav,
  role,
  onRoleChange,
  roles = ["nurse", "doctor", "pharmacist", "ops"],
  greeting,
  userName,
  lang,
  onLangChange,
  actions,
  account,
  labels,
  children,
}: {
  nav: ShellNavItem[];
  role: ShellRole;
  onRoleChange?: (r: ShellRole) => void;
  roles?: ShellRole[];
  greeting: ReactNode;
  userName: string;
  lang: Lang;
  onLangChange?: (l: Lang) => void;
  actions?: ReactNode;
  /** Replaces the plain avatar at the end of the top bar, e.g. the staff account menu (app/_shared/AccountMenu). */
  account?: ReactNode;
  /** Override chrome strings (defaults follow `lang`). Role names may be partial. */
  labels?: Partial<Omit<ShellLabels, "roles">> & { roles?: Partial<Record<ShellRole, string>> };
  children: ReactNode;
}) {
  const base = shellLabels[lang];
  const t = { ...base, ...labels, roles: { ...base.roles, ...labels?.roles } };

  // The UI language must reach `lang` so :lang(th) rules and screen-reader voices apply.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div lang={lang} className="min-h-[100dvh] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-sheet focus:px-4 focus:py-2 focus:text-small focus:font-semibold focus:text-ocean focus:shadow-sheet-lifted"
      >
        {t.skip}
      </a>
      <aside className="glass flex flex-col gap-6 border-b border-rule/70 px-4 py-4 lg:sticky lg:top-0 lg:h-[100dvh] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="flex items-center gap-2.5">
          <Logo height={34} />
        </div>
        {onRoleChange && (
          <SegmentedControl
            ariaLabel={t.roleGroup}
            size="sm"
            layout="grid2"
            activation="manual"
            value={role}
            onChange={onRoleChange}
            options={roles.map((r) => ({ value: r, label: t.roles[r] }))}
          />
        )}
        <nav aria-label={t.nav} className="flex gap-1 overflow-x-auto lg:flex-col">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.active ? "page" : undefined}
              className={cx(
                "flex h-11 shrink-0 items-center gap-3 rounded-full px-4 text-body font-semibold transition-colors duration-quick ease-pen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean",
                n.active ? "bg-teal-tint text-teal shadow-hairline" : "text-ink-soft hover:bg-sheet hover:text-ink",
              )}
            >
              {n.icon}
              <span>{n.label}</span>
              {!!n.alert && <span className="ml-auto rounded-full bg-signal px-2 text-micro font-bold text-on-signal tabular-nums">{n.alert}</span>}
            </Link>
          ))}
        </nav>
        <p className="mt-auto hidden text-micro text-graphite lg:block">{t.disclaimer}</p>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-4 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <p className="text-small text-ink-soft">{greeting}</p>
            <p className="truncate text-title font-extrabold text-ink">{userName}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {actions}
            {onLangChange && (
              <SegmentedControl
                ariaLabel={t.language}
                size="sm"
                value={lang}
                onChange={onLangChange}
                options={(["th", "it", "en"] as Lang[]).map((l) => ({ value: l, label: langLabel[l], lang: l }))}
              />
            )}
            {account ?? <Avatar name={userName} size={40} />}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-6 pb-8 pt-4 focus:outline-none">{children}</main>
      </div>
    </div>
  );
}
