import type { ReactNode } from "react";
import { CountUpText } from "./CountUp";
import { Icon } from "./Icon";
import { cx } from "./cx";

const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

export interface StatItem {
  /** The number as published, e.g. "1 in 4". Never invented: every item needs a source. */
  value: ReactNode;
  label: ReactNode;
  source: { label: ReactNode; href?: string };
}

/**
 * A row of sourced research numbers ("Why MedX"). Big gradient numbers, a plain label, and the source under each.
 * Numbers come from cited research (README), never from the demo, and never in red.
 * A written value ("49.1%", "13 to 59%") counts up once when the strip comes on screen (`CountUpText`); the server
 * HTML, no-JS and reduced motion show it as written.
 */
export function StatStrip({
  items,
  tone = "light",
  newTabLabel = "opens in a new tab",
  className,
}: {
  items: StatItem[];
  tone?: "light" | "dark";
  /** Screen-reader note for external source links. */
  newTabLabel?: string;
  className?: string;
}) {
  const dark = tone === "dark";
  const n = Math.min(4, Math.max(1, items.length)) as keyof typeof cols;
  return (
    <ul
      className={cx(
        "mx-reveal grid grid-cols-1 gap-px overflow-hidden rounded-bento",
        cols[n],
        dark ? "bg-on-primary/15 ring-1 ring-inset ring-on-primary/15" : "border border-rule/70 bg-rule/70 shadow-sheet",
        className,
      )}
    >
      {items.map((it, i) => (
        <li key={i} className={cx("flex flex-col gap-2 p-6 sm:p-7", dark ? "bg-ink" : "bg-sheet")}>
          <p className={cx("w-fit text-h2 font-extrabold", dark ? "text-brand-gradient-light" : "text-brand-gradient")}>
            {typeof it.value === "string" ? <CountUpText text={it.value} /> : it.value}
          </p>
          <p className={cx("text-body", dark ? "text-on-primary/80" : "text-ink-soft")}>{it.label}</p>
          {it.source.href ? (
            <a
              href={it.source.href}
              target="_blank"
              rel="noreferrer"
              className={cx("mt-auto inline-flex w-fit items-center gap-1 pt-2 text-micro font-semibold underline-offset-4 hover:underline", dark ? "text-on-primary/85" : "text-ocean")}
            >
              {it.source.label}
              <Icon name="arrow-up-right" size={12} />
              <span className="sr-only">({newTabLabel})</span>
            </a>
          ) : (
            <p className={cx("mt-auto pt-2 text-micro", dark ? "text-on-primary/70" : "text-graphite")}>{it.source.label}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
