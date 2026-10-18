import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "quiet" | "signal" | "onSignal" | "onDark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Brand gradient pill with a soft top highlight. One primary per view.
  primary: "bg-primary-gradient text-on-primary shadow-button hover:-translate-y-px hover:brightness-105",
  secondary: "bg-sheet text-ink border border-rule-strong/50 shadow-hairline hover:border-ocean hover:text-ocean",
  quiet: "text-ocean hover:bg-ocean-tint",
  // Only for actions caused by a red flag. Never decorative.
  signal: "bg-signal-gradient text-on-signal shadow-[0_10px_18px_-10px_rgba(158,16,36,0.8)] hover:brightness-105",
  // On a red surface: white outline pill.
  onSignal: "text-on-signal border border-on-signal/80 hover:bg-on-signal hover:text-signal",
  // On the brand gradient or the ink surface: white pill, ocean text (never on red).
  onDark: "bg-sheet text-ocean shadow-[0_8px_16px_-10px_rgba(8,30,60,0.45)] hover:-translate-y-px",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-small",
  md: "h-10 px-4 text-body",
  lg: "h-12 px-6 text-lead", // patient-sized: 48px target; also the marketing call to action
};

/**
 * Class string for anything that should look like a MedX button (a <button>, <Link> or <a>).
 * Motion (DIRECTION.md 5): hover colour 140 ms, press dips to 98% (`mx-press`), the focus ring grows out from the edge.
 * Under reduced motion there is no lift and no dip. Signal buttons never move (red stays still).
 */
export function buttonClasses({ variant = "secondary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cx(
    "mx-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold",
    "transition-[background-color,border-color,color,transform,translate,scale,filter,box-shadow,outline-offset] duration-quick ease-pen",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean",
    "disabled:pointer-events-none disabled:border-rule disabled:bg-muted disabled:bg-none disabled:text-graphite disabled:shadow-none",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Optional leading icon, e.g. <Icon name="check" />. */
  icon?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", icon, className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: Variant;
  size?: Size;
  /** Leading icon. */
  icon?: ReactNode;
  /** Trailing icon, e.g. <Icon name="arrow-right" />. */
  iconEnd?: ReactNode;
  /** Use a plain <a> (full page load), e.g. for /patient (static Expo export) or files such as the video. */
  hardNav?: boolean;
}

/** A link that looks like a button (calls to action on marketing pages, "Open" links in cards). */
export function ButtonLink({ href, variant = "secondary", size = "md", icon, iconEnd, hardNav = false, className, children, ...rest }: ButtonLinkProps) {
  const cls = buttonClasses({ variant, size, className });
  const body = (
    <>
      {icon}
      {children}
      {iconEnd}
    </>
  );
  return hardNav ? (
    <a href={href} className={cls} {...rest}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls} {...rest}>
      {body}
    </Link>
  );
}
