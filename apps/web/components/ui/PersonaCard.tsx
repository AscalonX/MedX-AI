import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { cx } from "./cx";

/** Grid for "Try a role": one column on phones, two from 640px, three from 1024px. */
export function PersonaGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4", className)}>{children}</ul>;
}

/**
 * One demo persona (DIRECTION.md 12): the whole card is one link into the live demo as that role.
 * Initials (or an icon) on the brand gradient, synthetic name, role in teal, one line on what they do, an arrow.
 * Personas are synthetic. No photos, no Fin. Render inside `PersonaGrid` (it is an <li>).
 */
export function PersonaCard({
  href,
  name,
  role,
  description,
  icon,
  tag,
  cta,
  hardNav = false,
  className,
}: {
  href: string;
  /** Synthetic display name, e.g. "Nurse A. Rossi". */
  name: string;
  /** Role, e.g. "Triage nurse". */
  role: ReactNode;
  description?: ReactNode;
  /** Replaces the initials, e.g. <Icon name="smartphone" />. */
  icon?: ReactNode;
  /** Where it runs, e.g. "Phone" or "Web". */
  tag?: ReactNode;
  /** Screen-reader suffix for the link, e.g. "Open the demo as this person". */
  cta?: string;
  /** Plain <a> (full page load), e.g. for the patient app at /patient. */
  hardNav?: boolean;
  className?: string;
}) {
  const initials = name
    .replace(/^(Dr|Nurse|Pharm|Mr|Mrs|Ms)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const cls = cx(
    "group mx-lift flex h-full items-center gap-4 rounded-card border border-rule/70 bg-sheet p-4 shadow-sheet sm:p-5",
    // Hover lift (DIRECTION.md 5): rises 3px, the lifted shadow fades in, the border warms to ocean, the arrow slides.
    "transition-[translate,border-color,outline-offset] duration-base ease-glide hover:border-ocean/40",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean",
  );
  const body = (
    <>
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-gradient text-body font-bold text-on-primary ring-2 ring-sheet">
        {icon ?? initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-lead font-bold text-ink">{name}</span>
          {tag && <span className="inline-flex h-6 items-center rounded-full bg-ocean-tint px-2.5 text-micro font-semibold text-ocean">{tag}</span>}
        </span>
        <span className="text-small font-semibold text-teal">{role}</span>
        {description && <span className="mt-1 text-small text-ink-soft">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-ocean-tint text-ocean transition-[translate,background-color,color] duration-base ease-glide group-hover:bg-ocean group-hover:text-on-primary motion-safe:group-hover:translate-x-1"
      >
        <Icon name="arrow-right" size={18} />
      </span>
      {cta && <span className="sr-only">{cta}</span>}
    </>
  );
  return (
    <li className={cx("mx-reveal list-none", className)}>
      {hardNav ? (
        <a href={href} className={cls}>
          {body}
        </a>
      ) : (
        <Link href={href} className={cls}>
          {body}
        </Link>
      )}
    </li>
  );
}
