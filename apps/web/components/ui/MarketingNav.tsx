"use client";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { Lang } from "@medx/shared";
import { ButtonLink } from "./Button";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { SegmentedControl } from "./SegmentedControl";
import { cx } from "./cx";

export interface MarketingNavLabels {
  /** Accessible name of the link list. */
  nav: string;
  menuOpen: string;
  menuClose: string;
  language: string;
  skip: string;
  /** Accessible name of the logo link. */
  home: string;
}

const defaultLabels: MarketingNavLabels = {
  nav: "Main",
  menuOpen: "Open menu",
  menuClose: "Close menu",
  language: "Language",
  skip: "Skip to content",
  home: "MedX home",
};

const langLabel: Record<Lang, string> = { en: "EN", th: "ไทย", it: "IT" };

/**
 * Sticky translucent navigation for marketing pages (DIRECTION.md 12): a floating glass pill with the vector logo,
 * section links, the language toggle and one primary call to action. Below 1024px the links move into a menu.
 * Includes the "Skip to content" link (target `#main-content` by default).
 * Once the page scrolls, the pill shrinks a little and a denser, blurrier glass layer with the nav shadow fades in
 * (`mx-nav-pill`, transform and opacity only; the header keeps its height). No movement under reduced motion.
 */
export function MarketingNav({
  links,
  cta,
  lang,
  onLangChange,
  langs = ["en", "th", "it"],
  labels,
  homeHref = "/",
  skipHref = "#main-content",
  className,
}: {
  /** In-page anchors or routes, e.g. { href: "#how-it-works", label: "How it works" }. */
  links: { href: string; label: ReactNode }[];
  /** The one primary action, e.g. { href: "#try-a-role", label: "Try the demo" }. */
  cta?: { href: string; label: ReactNode; hardNav?: boolean };
  lang?: Lang;
  onLangChange?: (l: Lang) => void;
  langs?: Lang[];
  labels?: Partial<MarketingNavLabels>;
  homeHref?: string;
  skipHref?: string;
  className?: string;
}) {
  const t = { ...defaultLabels, ...labels };
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuId = useId();

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 12);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const langControl =
    lang && onLangChange ? (
      <SegmentedControl
        ariaLabel={t.language}
        size="sm"
        activation="manual"
        value={lang}
        onChange={onLangChange}
        options={langs.map((l) => ({ value: l, label: langLabel[l], lang: l }))}
      />
    ) : null;

  return (
    <header className={cx("sticky top-0 z-40 px-3 pt-3 sm:px-6", className)}>
      <a
        href={skipHref}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-sheet focus:px-4 focus:py-2 focus:text-small focus:font-semibold focus:text-ocean focus:shadow-sheet-lifted"
      >
        {t.skip}
      </a>
      <div data-scrolled={scrolled} className="mx-nav-pill mx-auto flex h-16 max-w-page items-center gap-2 rounded-full border border-sheet/70 pl-4 pr-2 sm:pl-5">
        <Link href={homeHref} aria-label={t.home} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean">
          <Logo height={30} />
        </Link>
        <nav aria-label={t.nav} className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="inline-flex h-9 items-center rounded-full px-3.5 text-small font-semibold text-ink-soft transition-[background-color,color,outline-offset] duration-quick ease-pen hover:bg-sheet/80 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {langControl && <div className="hidden sm:block">{langControl}</div>}
          {cta && (
            <ButtonLink href={cta.href} hardNav={cta.hardNav} variant="primary" size="sm" iconEnd={<Icon name="arrow-right" size={16} />}>
              {cta.label}
            </ButtonLink>
          )}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? t.menuClose : t.menuOpen}
            onClick={() => setOpen((o) => !o)}
            className="mx-press grid size-10 place-items-center rounded-full text-ink transition-[background-color,color,scale,outline-offset] duration-quick ease-pen hover:bg-sheet/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean lg:hidden"
          >
            <Icon name={open ? "x" : "menu"} size={20} />
          </button>
        </div>
      </div>
      <div id={menuId} hidden={!open} className="glass mx-enter mx-auto mt-2 max-w-page rounded-card border border-sheet/70 p-2 shadow-nav lg:hidden">
        <nav aria-label={t.nav}>
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="flex h-12 items-center rounded-2xl px-4 text-body font-semibold text-ink hover:bg-sheet">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {langControl && <div className="mt-1 border-t border-rule/70 px-3 pb-1 pt-3 sm:hidden">{langControl}</div>}
      </div>
    </header>
  );
}
