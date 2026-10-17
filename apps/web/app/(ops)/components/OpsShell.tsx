"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "@medx/shared";
import { Avatar, Icon, type ShellRole } from "@/components/ui";
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
        onChange(options[next].value);
      }}>{option.label}</button>)}
  </div>;
}

/** Ops-owned shell keeps every label localized without modifying the shared component. */
export function OpsShell({ lang, onLangChange, onRoleChange, children }: {
  lang: Lang; onLangChange: (lang: Lang) => void; onRoleChange: (role: ShellRole) => void; children: ReactNode;
}) {
  const nav = [
    { href: "/", label: copy.home, icon: "home" as const },
    { href: "/review", label: copy.reviewQueue, icon: "clipboard-list" as const },
    { href: "/pharmacy", label: copy.pharmacy, icon: "pill" as const },
    { href: "/ops", label: copy.ops, icon: "activity" as const },
  ];
  return <div className={styles.shell}>
    <a className={styles.skip} href="#ops-content">{copy.skip[lang]}</a>
    <aside className={styles.sidebar}>
      <div className="flex items-center gap-2.5"><span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-primary-gradient font-extrabold text-on-primary">M</span><span className="text-lead font-extrabold text-ink">MedX</span></div>
      <Switch label={copy.role[lang]} grid value="ops" onChange={onRoleChange} options={(["nurse", "doctor", "pharmacist", "ops"] as ShellRole[]).map(value => ({ value, label: copy[value][lang] }))} />
      <nav aria-label={copy.mainNav[lang]} className={styles.nav}>{nav.map(item => <Link key={item.href} href={item.href} aria-current={item.href === "/ops" ? "page" : undefined}><Icon name={item.icon} size={18} />{item.label[lang]}</Link>)}</nav>
      <p className={styles.sidebarNote}>{copy.disclaimer[lang]}</p>
    </aside>
    <div className="flex min-w-0 flex-col">
      <header className={styles.shellHeader}>
        <div><p className="text-small text-ink-soft">{copy.greeting[lang]}</p><p className="text-title font-extrabold text-ink">{copy.headNurse[lang]}</p></div>
        <div className={styles.shellActions}><Switch label={copy.language[lang]} value={lang} onChange={onLangChange} options={languages.map(item => ({ value: item.lang, label: item.label, lang: item.lang }))} /><Avatar name={copy.headNurse[lang]} size={40} /></div>
      </header>
      <main id="ops-content" tabIndex={-1} className="min-w-0 flex-1 px-6 pb-8 pt-4">{children}</main>
    </div>
  </div>;
}
