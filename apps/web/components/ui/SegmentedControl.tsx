"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean";

/**
 * Pill segmented control: muted track, white raised thumb. Use for language and role switches.
 * A real radiogroup: one tab stop (roving tabIndex), arrow keys / Home / End move and select.
 */
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
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (current === last ? 0 : current + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (current === 0 ? last : current - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx(layout === "grid2" ? "grid w-full grid-cols-2 gap-0.5 rounded-2xl" : "inline-flex rounded-full", "bg-muted p-1", className)}>
      {options.map((o, i) => {
        const on = i === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            lang={o.lang}
            onClick={() => onChange(o.value)}
            onKeyDown={onKeyDown}
            className={cx(
              "rounded-full font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-base ease-pen",
              focusRing,
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
        focusRing,
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
