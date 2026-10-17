"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "@medx/shared";
import { Avatar } from "./Avatar";
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

const roleLabel: Record<ShellRole, string> = { nurse: "Nurse", doctor: "Doctor", pharmacist: "Pharmacist", ops: "Ops" };
const langLabel: Record<Lang, string> = { th: "ไทย", it: "IT", en: "EN" };

/**
 * Web app shell (DIRECTION.md 8.2): left sidebar (brand, role switch, nav), top bar (greeting, language pill, avatar).
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
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6 border-b border-rule/70 bg-sheet/70 px-4 py-4 lg:sticky lg:top-0 lg:h-[100dvh] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-primary-gradient text-body font-extrabold text-on-primary">M</span>
          <span className="text-lead font-extrabold tracking-tight text-ink">MedX Bridge</span>
        </div>
        {onRoleChange && (
          <SegmentedControl
            ariaLabel="Role"
            size="sm"
            layout="grid2"
            value={role}
            onChange={onRoleChange}
            options={roles.map((r) => ({ value: r, label: roleLabel[r] }))}
          />
        )}
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.active ? "page" : undefined}
              className={cx(
                "flex h-11 shrink-0 items-center gap-3 rounded-full px-4 text-body font-semibold transition-colors duration-quick ease-pen",
                n.active ? "bg-teal-tint text-teal" : "text-ink-soft hover:bg-paper hover:text-ink",
              )}
            >
              {n.icon}
              <span>{n.label}</span>
              {!!n.alert && <span className="ml-auto rounded-full bg-signal px-2 text-micro font-bold text-on-signal tabular-nums">{n.alert}</span>}
            </Link>
          ))}
        </nav>
        <p className="mt-auto hidden text-micro text-graphite lg:block">Research prototype. Supports clinicians; does not diagnose.</p>
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
                ariaLabel="Language"
                size="sm"
                value={lang}
                onChange={onLangChange}
                options={(["th", "it", "en"] as Lang[]).map((l) => ({ value: l, label: langLabel[l], lang: l }))}
              />
            )}
            <Avatar name={userName} size={40} />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 pb-8 pt-4">{children}</main>
      </div>
    </div>
  );
}
