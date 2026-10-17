"use client";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Pill segmented control: muted track, white raised thumb. Use for language and role switches. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  layout = "inline",
  className,
}: {
  options: { value: T; label: ReactNode; lang?: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  /** "grid2" lays options out in two columns (narrow sidebars). */
  layout?: "inline" | "grid2";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx(layout === "grid2" ? "grid w-full grid-cols-2 gap-0.5 rounded-2xl" : "inline-flex rounded-full", "bg-muted p-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            lang={o.lang}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-full font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-base ease-pen",
              size === "sm" ? "h-7 px-3 text-micro" : "h-8 px-4 text-small",
              on ? "bg-sheet text-ink shadow-[0_2px_8px_-2px_rgba(15,45,80,0.2)]" : "text-ink-soft hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toggleable filter pill. */
export function Pill({ active = false, icon, children, onClick, count }: { active?: boolean; icon?: ReactNode; children: ReactNode; onClick?: () => void; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-full px-4 text-small font-semibold transition-colors duration-quick ease-pen",
        active ? "bg-ink text-sheet" : "bg-sheet text-ink-soft ring-1 ring-inset ring-rule hover:text-ink",
      )}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className={cx("rounded-full px-1.5 text-micro tabular-nums", active ? "bg-white/20" : "bg-muted")}>{count}</span>
      )}
    </button>
  );
}
