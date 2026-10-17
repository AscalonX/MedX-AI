import type { ReactNode } from "react";
import { cx } from "./cx";

/** Says what is empty and how it fills. One optional action. */
export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      {icon && <span className="mb-1 grid size-12 place-items-center rounded-full bg-ocean-tint text-ocean">{icon}</span>}
      <p className="text-lead font-bold text-ink">{title}</p>
      {body && <p className="max-w-[40ch] text-small text-ink-soft">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
