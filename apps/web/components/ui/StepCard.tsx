import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { cx } from "./cx";

const cols = { 3: "md:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4", 5: "md:grid-cols-2 lg:grid-cols-5" } as const;

/** Ordered list of `StepCard`s ("How it works"). The last step is always the human (`human`). */
export function StepList({ children, columns = 4, className }: { children: ReactNode; columns?: keyof typeof cols; className?: string }) {
  return <ol className={cx("grid grid-cols-1 gap-4 lg:gap-5", cols[columns], className)}>{children}</ol>;
}

/**
 * One numbered step. The big number is decorative (the <ol> carries the order for assistive tech).
 * `human` marks the step where a person decides: teal ring and a teal "a person decides" chip, because teal means
 * "done by a clinician" across MedX (DIRECTION.md 2). It is never the dark card and never red.
 * A progress line along the top edge draws itself just after the card reveals, so a row of steps reads 1, 2, 3
 * (`mx-draw`, DIRECTION.md 5); it is simply there without JS and under reduced motion.
 */
export function StepCard({
  step,
  title,
  body,
  icon,
  human = false,
  humanLabel,
  className,
  children,
}: {
  step: number;
  title: ReactNode;
  body?: ReactNode;
  icon?: ReactNode;
  human?: boolean;
  /** Visible on the human step, e.g. "A person decides". */
  humanLabel?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <li
      className={cx(
        "mx-reveal relative flex flex-col gap-3 overflow-hidden rounded-card bg-sheet p-6 shadow-sheet",
        human ? "ring-2 ring-inset ring-teal/40" : "border border-rule/70",
        className,
      )}
    >
      <span aria-hidden="true" className={cx("mx-draw pointer-events-none absolute inset-x-6 top-0 h-1 rounded-b-full", human ? "bg-teal" : "bg-primary-gradient")} />
      <span
        aria-hidden="true"
        className={cx("pointer-events-none absolute right-5 top-3 text-[64px] font-extrabold leading-none tracking-tight", human ? "text-teal/15" : "text-ocean/10")}
      >
        {step}
      </span>
      {icon && (
        <span aria-hidden="true" className={cx("grid size-11 place-items-center rounded-2xl", human ? "bg-teal text-on-primary" : "bg-ocean-tint text-ocean")}>
          {icon}
        </span>
      )}
      <h3 className="pr-10 text-h3 font-bold text-ink">{title}</h3>
      {body && <p className="text-body text-ink-soft">{body}</p>}
      {children}
      {human && humanLabel && (
        <span className="mt-auto inline-flex h-7 w-fit items-center gap-1.5 rounded-full bg-teal-tint px-3 text-micro font-semibold text-teal">
          <Icon name="user-check" size={14} />
          {humanLabel}
        </span>
      )}
    </li>
  );
}
