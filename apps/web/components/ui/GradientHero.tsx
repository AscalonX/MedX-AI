import type { ReactNode } from "react";
import type { MascotPose } from "@medx/shared/src/mascot";
import { Mascot } from "./Mascot";
import { cx } from "./cx";

/**
 * The one bold card per screen (DIRECTION.md 4). Teal-to-ocean gradient, white text (AA on both stops).
 * `tone="signal"` is reserved for the red-flag screen.
 * `mascot` puts Mali on the right, standing on the card's bottom edge (primary tone only: never on red).
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
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-5 right-1 -z-10 w-28 sm:right-3 sm:w-44">
          {/* soft light disc so the teal elephant reads on the teal gradient */}
          <span className="absolute inset-x-1 bottom-3 top-5 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.55),rgba(255,255,255,0.18)_70%,transparent)]" />
          <Mascot pose={mascot} size={176} className="relative h-auto w-full drop-shadow-[0_10px_14px_rgba(8,40,90,0.35)]" />
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
    "inline-flex h-11 items-center gap-2 rounded-full bg-sheet px-5 text-body font-semibold text-ocean shadow-[0_8px_16px_-10px_rgba(0,0,0,0.4)] transition-transform duration-quick ease-pen active:scale-[0.97]";
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
