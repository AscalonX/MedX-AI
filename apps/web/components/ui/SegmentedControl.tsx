"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean";

/**
 * Pill segmented control: muted track, white raised thumb. Use for language and role switches.
 * A real radiogroup: one tab stop (roving tabIndex). activation "auto" (default, in-place toggles): arrow keys / Home /
 * End move and select. activation "manual" (a choice that navigates or reloads, WCAG 3.2.2): those keys only move
 * focus; Enter, Space or a click selects.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  layout = "inline",
  activation = "auto",
  className,
}: {
  options: { value: T; label: ReactNode; lang?: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  /** "grid2" lays options out in two columns (narrow sidebars). */
  layout?: "inline" | "grid2";
  /** "manual" when choosing changes the page or route: arrows move focus, Enter/Space/click select. */
  activation?: "auto" | "manual";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, from: number) {
    const next = segmentKeyTarget(e.key, activation === "manual" ? from : current, options.length);
    if (next < 0) return;
    e.preventDefault();
    if (activation === "auto") onChange(options[next]!.value);
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
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              "mx-press rounded-full font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,scale,outline-offset] duration-base ease-glide",
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

/** Index an arrow / Home / End key moves to from `from` (wrapping), or -1 for any other key. Pure, unit tested. */
export function segmentKeyTarget(key: string, from: number, count: number): number {
  const last = count - 1;
  if (count <= 0) return -1;
  if (key === "ArrowRight" || key === "ArrowDown") return from >= last ? 0 : from + 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return from <= 0 ? last : from - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return -1;
}

/** Toggleable filter pill. */
export function Pill({ active = false, icon, children, onClick, count }: { active?: boolean; icon?: ReactNode; children: ReactNode; onClick?: () => void; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "mx-press inline-flex h-9 items-center gap-2 rounded-full px-4 text-small font-semibold transition-[background-color,color,box-shadow,scale,outline-offset] duration-base ease-glide",
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
