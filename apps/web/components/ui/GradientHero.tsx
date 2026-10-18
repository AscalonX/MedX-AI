import type { ReactNode } from "react";
import type { MascotPose } from "@medx/shared/src/mascot";
import { Mascot } from "./Mascot";
import { cx } from "./cx";

/**
 * The one bold card per screen (DIRECTION.md 4). Teal-to-ocean gradient, white text (AA on both stops).
 * `tone="signal"` is reserved for the red-flag screen.
 * `mascot` puts the 3D Fin on the right, standing on the card's bottom edge on a soft light disc
 * (primary tone only: never on red; `GradientHero` refuses it for `tone="signal"`).
 */
export function GradientHero({
  title,
  subtitle,
  action,
  children,
  tone = "primary",
  mascot,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  tone?: "primary" | "signal";
  mascot?: MascotPose;
  className?: string;
}) {
  const showMascot = !!mascot && tone === "primary";
  return (
    <section
      className={cx(
        "relative isolate overflow-hidden rounded-hero p-6 text-on-primary",
        showMascot && "pr-32 sm:pr-48",
        tone === "primary" ? "bg-primary-gradient shadow-[var(--shadow-hero)]" : "bg-signal-gradient shadow-[var(--shadow-signal)]",
        className,
      )}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 size-64 rounded-full bg-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 -z-10 size-48 rounded-full bg-white/[0.06]" />
      {showMascot && (
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-4 right-1 -z-10 w-28 sm:right-3 sm:w-44">
          {/* soft light disc so the blue 3D dolphin separates from the teal-to-ocean gradient */}
          <span className="absolute inset-x-0 bottom-2 top-4 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.62),rgba(255,255,255,0.22)_68%,transparent)]" />
          <Mascot pose={mascot} size={176} className="relative h-auto w-full [filter:drop-shadow(0_12px_16px_rgba(8,40,90,0.35))]" />
        </span>
      )}
      <h2 className="text-title font-bold">{title}</h2>
      {subtitle && <p className="mt-1 max-w-[52ch] text-body text-on-primary/90">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap gap-2">{action}</div>}
    </section>
  );
}

/** White pill button for use on the gradient hero. */
export function HeroAction({ children, icon, onClick, href }: { children: ReactNode; icon?: ReactNode; onClick?: () => void; href?: string }) {
  const cls =
    "mx-press inline-flex h-11 items-center gap-2 rounded-full bg-sheet px-5 text-body font-semibold text-ocean shadow-[0_8px_16px_-10px_rgba(8,30,60,0.45)] transition-[transform,translate,scale,box-shadow,outline-offset] duration-quick ease-pen hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary";
  return href ? (
    <a href={href} className={cls}>
      {icon}
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {icon}
      {children}
    </button>
  );
}
