"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { SuccessCheck } from "./SuccessCheck";
import { cx } from "./cx";

/**
 * Confirmation receipt for clinician approval and pharmacy sign-off (DIRECTION.md 6f).
 * Teal check (pops in and draws itself), title, label/value rows, optional footer (e.g. a "Next case" button).
 * The card rises in on arrival (static under reduced motion).
 * It is a polite status region, and by default takes focus when it appears so focus never drops to <body>.
 */
export function Receipt({
  title,
  rows,
  footer,
  focusOnMount = true,
  className,
}: {
  title: ReactNode;
  rows: { label: ReactNode; value: ReactNode }[];
  footer?: ReactNode;
  focusOnMount?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={cx(
        "mx-enter rounded-card border border-teal/25 bg-sheet p-5 shadow-sheet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <SuccessCheck size={40} />
        <h2 className="text-lead font-bold text-ink">{title}</h2>
      </div>
      <dl className="mt-4 divide-y divide-rule rounded-2xl bg-paper px-4">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-small text-ink-soft">{r.label}</dt>
            <dd className="text-right text-body font-semibold text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-4 flex flex-wrap items-center gap-2">{footer}</div>}
    </section>
  );
}
