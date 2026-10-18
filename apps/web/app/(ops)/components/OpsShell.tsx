"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Lang, SessionListItem } from "@medx/shared";
import { Icon, Logo, type ShellRole } from "@/components/ui";
import { AccountMenu } from "../../_shared/AccountMenu";
import { DemoGuide } from "../../_shared/DemoGuide";
import { SignInSheet, useIdentityGate } from "../../_shared/SignIn";
import { rememberIdentity, signOut } from "../../_shared/identity";
import { greetingFor } from "../../_shared/useStaffRole";
import { copy, languages } from "../i18n";
import styles from "../ops.module.css";

function Switch<T extends string>({ label, options, value, onChange, grid = false }: {
  label: string; options: { value: T; label: string; lang?: string }[]; value: T; onChange: (value: T) => void; grid?: boolean;
}) {
  return <div role="radiogroup" aria-label={label} className={`${styles.switch} ${grid ? styles.roleSwitch : ""}`}>
    {options.map((option, index) => <button key={option.value} type="button" role="radio" lang={option.lang}
      aria-checked={option.value === value} tabIndex={option.value === value ? 0 : -1}
      onClick={() => onChange(option.value)} onKeyDown={event => {
        const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : delta ? (index + delta + options.length) % options.length : null;
        if (next === null) return;
        event.preventDefault();
        (event.currentTarget.parentElement?.children[next] as HTMLButtonElement | undefined)?.focus();
        // The role switch navigates (WCAG 3.2.2): arrows only move focus there; Enter, Space or a click selects.
        if (!grid) onChange(options[next].value);
      }}>{option.label}</button>)}
  </div>;
}

/**
 * Ops-owned shell keeps every label localized without modifying the shared component. Same look as AppShell
 * (translucent sidebar, pill nav). `rows` are the dashboard's polled sessions, handed to the demo guide.
 */
export function OpsShell({ lang, onLangChange, onRoleChange, userName, rows, children }: {
  lang: Lang; onLangChange: (lang: Lang) => void; onRoleChange: (role: ShellRole) => void; userName?: string; rows?: SessionListItem[] | null; children: ReactNode;
}) {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => { setHour(new Date().getHours()); }, []);
  const router = useRouter();
  // Sign-in (w20): the account menu, and "Who's signing in?" when no ops identity is stored. Ops has no write
  // actions, so nothing on the board is gated: Refresh, Retry and every link keep working while the sheet shows.
  const gate = useIdentityGate("ops");
  const [nudge, setNudge] = useState(0);
  const name = userName ?? copy.headNurse[lang];
  const choose = (n: string) => { rememberIdentity("ops", n); gate.confirm("ops"); };
  const nav = [
    // Home is the demo hub (persona picker), so a visitor can switch role from here.
    { href: "/demo", label: copy.home, icon: "home" as const },
    { href: "/review", label: copy.reviewQueue, icon: "clipboard-list" as const },
    { href: "/pharmacy", label: copy.pharmacy, icon: "pill" as const },
    { href: "/ops", label: copy.ops, icon: "activity" as const },
  ];
  return <div className={styles.shell}>
    <a className={styles.skip} href="#ops-content">{copy.skip[lang]}</a>
    <aside className={styles.sidebar}>
      <Logo height={34} />
      <Switch label={copy.role[lang]} grid value="ops" onChange={onRoleChange} options={(["nurse", "doctor", "pharmacist", "ops"] as ShellRole[]).map(value => ({ value, label: copy[value][lang] }))} />
      <nav aria-label={copy.mainNav[lang]} className={styles.nav}>{nav.map(item => <Link key={item.href} href={item.href} aria-current={item.href === "/ops" ? "page" : undefined}><Icon name={item.icon} size={18} />{item.label[lang]}</Link>)}</nav>
      <p className={styles.sidebarNote}>{copy.disclaimer[lang]}</p>
    </aside>
    <div className="flex min-w-0 flex-col">
      <header className={styles.shellHeader}>
        <div><p className="text-small text-ink-soft">{hour === null ? copy.greeting[lang] : greetingFor(lang, hour)}</p><p className="text-title font-extrabold text-ink">{copy.headNurse[lang]}</p></div>
        <div className={styles.shellActions}><Switch label={copy.language[lang]} value={lang} onChange={onLangChange} options={languages.map(item => ({ value: item.lang, label: item.label, lang: item.lang }))} /><AccountMenu name={name} roleLabel={copy.ops[lang]} signedIn={!gate.needed} lang={lang} onSignOut={() => router.push(signOut().href)} onSignIn={() => setNudge((n) => n + 1)} /></div>
      </header>
      <main id="ops-content" tabIndex={-1} className="min-w-0 flex-1 px-6 pb-8 pt-4 focus:outline-none">
        {/* Demo guide (M-06): renders only when a demo persona was chosen. Neutral, no Fin, no red. */}
        <DemoGuide lang={lang} role="ops" userName={userName} rows={rows} className={styles.guide} />
        {children}
        <SignInSheet open={gate.needed} lang={lang} role="ops" roleLabel={copy.ops[lang]} onChoose={choose} nudge={nudge} />
      </main>
    </div>
  </div>;
}
