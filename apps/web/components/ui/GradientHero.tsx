import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * The one bold card per screen (DIRECTION.md 4). Teal-to-ocean gradient, white text (AA on both stops).
 * `tone="signal"` is reserved for the red-flag screen.
 */
export function GradientHero({
  title,
  subtitle,
  action,
  children,
  tone = "primary",
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  tone?: "primary" | "signal";
  className?: string;
}) {
  return (
    <section
      className={cx(
        "relative isolate overflow-hidden rounded-hero p-6 text-on-primary",
        tone === "primary" ? "bg-primary-gradient shadow-[var(--shadow-hero)]" : "bg-signal-gradient shadow-[var(--shadow-signal)]",
        className,
      )}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 size-64 rounded-full bg-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 -z-10 size-48 rounded-full bg-white/[0.06]" />
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
