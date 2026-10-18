import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { cx } from "./cx";

const tones = {
  // Done by a person (saved, approved, sent): teal disc.
  teal: "bg-teal-tint text-teal",
  // Information (copied, link ready): ocean disc.
  ocean: "bg-ocean-tint text-ocean",
} as const;

/**
 * Small confirmation that slides up and fades in (`.mx-toast`, 360 ms; static under reduced motion).
 * For calm news only ("Saved", "Link copied"). Never for red flags, alerts or errors: urgent content is the red-flag
 * card and never a toast. A polite status region; place it yourself (e.g. `fixed bottom-4 right-4`) and remove it
 * when done. `onClose` adds a close button with `closeLabel` as its name.
 */
export function Toast({
  title,
  body,
  icon,
  tone = "teal",
  action,
  onClose,
  closeLabel = "Close",
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof tones;
  action?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cx("mx-toast flex w-full max-w-sm items-start gap-3 rounded-card border border-rule/70 bg-sheet p-4 shadow-float", className)}>
      <span aria-hidden="true" className={cx("grid size-9 shrink-0 place-items-center rounded-full", tones[tone])}>
        {icon ?? <Icon name="check" size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">{title}</p>
        {body && <p className="mt-0.5 text-small text-ink-soft">{body}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="mx-press -m-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-soft transition-[background-color,color,scale] duration-quick ease-glide hover:bg-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
