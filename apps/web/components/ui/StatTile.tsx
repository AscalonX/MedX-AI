import type { ReactNode } from "react";
import { cx } from "./cx";

const tones = {
  default: "text-ink",
  teal: "text-teal",
  ocean: "text-ocean",
  signal: "text-signal", // only for counts of urgent things
} as const;

/** Big bold tabular number on a card. `value` null renders a dash-free placeholder, never 0. */
export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: string | number | null;
  unit?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2 rounded-card border border-rule/70 bg-sheet p-5 shadow-sheet", className)}>
      <div className="flex items-center justify-between gap-2 text-small font-medium text-ink-soft">
        <span>{label}</span>
        {icon && <span className="grid size-8 place-items-center rounded-full bg-paper text-ocean">{icon}</span>}
      </div>
      {value === null ? (
        <span className="mx-blank !h-8 !w-24" aria-label="No data yet" />
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
