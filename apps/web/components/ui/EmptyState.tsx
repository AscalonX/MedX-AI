import type { ReactNode } from "react";
import type { MascotPose } from "@medx/shared/src/mascot";
import { Mascot } from "./Mascot";
import { cx } from "./cx";

/**
 * Says what is empty and how it fills. One optional action.
 * `mascot` shows Fin (the mascot) instead of the icon disc (e.g. "pointing" for "ask the nurse", "happy" for "all done").
 * Never use the mascot for an empty state that sits beside an alert or red flag.
 */
export function EmptyState({
  icon,
  mascot,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  mascot?: MascotPose;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      {mascot && <Mascot pose={mascot} size={112} className="-mb-1" />}
      {!mascot && icon && <span className="mb-1 grid size-12 place-items-center rounded-full bg-ocean-tint text-ocean">{icon}</span>}
      <p className="text-lead font-bold text-ink">{title}</p>
      {body && <p className="max-w-[40ch] text-small text-ink-soft">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
