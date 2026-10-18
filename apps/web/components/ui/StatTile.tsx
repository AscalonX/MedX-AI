import type { ReactNode } from "react";
import { cx } from "./cx";

const tones = {
  default: "text-ink",
  teal: "text-teal",
  ocean: "text-ocean",
  signal: "text-signal", // only for counts of urgent things
} as const;

/** Big bold number on a card. `value` may be a <CountUp />. Null renders a visible "No data yet" pill, never 0. */
export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "default",
  emptyLabel = "No data yet",
  className,
}: {
  label: ReactNode;
  value: ReactNode | null;
  unit?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof tones;
  /** Visible text when `value` is null (localize it). */
  emptyLabel?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2 rounded-card border border-rule/70 bg-sheet p-5 shadow-sheet", className)}>
      <div className="flex items-center justify-between gap-2 text-small font-medium text-ink-soft">
        <span>{label}</span>
        {icon && <span className="grid size-9 place-items-center rounded-full bg-ocean-tint text-ocean">{icon}</span>}
      </div>
      {value === null ? (
        <span className="inline-flex h-8 w-fit items-center rounded-full bg-muted px-3 text-small text-graphite">{emptyLabel}</span>
      ) : (
        <p className={cx("text-stat font-extrabold tabular-nums", tones[tone])}>
          {value}
          {unit && <span className="ml-1 text-body font-semibold text-ink-soft">{unit}</span>}
        </p>
      )}
      {hint && <p className="text-micro text-graphite">{hint}</p>}
    </div>
  );
}
