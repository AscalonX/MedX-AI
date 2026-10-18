import type { ReactNode } from "react";
import type { MascotPose } from "@medx/shared/src/mascot";
import { Mascot } from "./Mascot";
import { cx } from "./cx";

/**
 * Says what is empty and how it fills. One optional action.
 * `mascot` shows the 3D Fin (112px) instead of the icon disc (e.g. "pointing" for "ask the nurse", "happy" for
 * "all done"). Never use the mascot for an empty state that sits beside an alert or red flag.
 * Rises in when it appears (`mx-enter`, static under reduced motion).
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
    <div className={cx("mx-enter flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      {mascot && <Mascot pose={mascot} size={112} className="-mb-1 drop-shadow-[0_10px_14px_rgba(15,45,80,0.18)]" />}
      {!mascot && icon && <span className="mb-1 grid size-12 place-items-center rounded-full bg-ocean-tint text-ocean">{icon}</span>}
      <p className="text-lead font-bold text-ink">{title}</p>
      {body && <p className="max-w-[40ch] text-small text-ink-soft">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
