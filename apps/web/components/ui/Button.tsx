import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "quiet" | "signal" | "onSignal";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  // Brand gradient pill. One primary per view.
  primary: "bg-primary-gradient text-on-primary shadow-[0_10px_18px_-10px_rgba(26,95,196,0.8)] hover:brightness-105",
  secondary: "bg-sheet text-ink border border-rule-strong/60 hover:border-ocean hover:text-ocean",
  quiet: "text-ocean hover:bg-ocean-tint",
  // Only for actions caused by a red flag. Never decorative.
  signal: "bg-signal-gradient text-on-signal shadow-[0_10px_18px_-10px_rgba(158,16,36,0.8)] hover:brightness-105",
  // On a red surface: white outline pill.
  onSignal: "text-on-signal border border-on-signal/80 hover:bg-on-signal hover:text-signal",
};
const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-body",
  lg: "h-12 px-6 text-lead", // patient-sized: 48px target
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Optional leading icon, e.g. <Icon name="check" />. */
  icon?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", icon, className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold",
        "transition-[background-color,border-color,color,transform,filter] duration-quick ease-pen active:scale-[0.97]",
        "disabled:pointer-events-none disabled:border-rule disabled:bg-muted disabled:bg-none disabled:text-graphite disabled:shadow-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
