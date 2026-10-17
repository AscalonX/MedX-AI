import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "quiet" | "signal" | "onSignal";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  // Ink on paper. One primary per view.
  primary: "bg-ink text-sheet hover:bg-ink-soft",
  secondary: "bg-sheet text-ink border border-rule-strong hover:border-ink",
  quiet: "text-ink underline-offset-4 hover:underline",
  // Only for actions caused by a red flag (escalate, call). Never decorative.
  signal: "bg-signal text-on-signal hover:brightness-95",
  // On the red band: outline in paper colour.
  onSignal: "text-on-signal border border-on-signal hover:bg-on-signal hover:text-signal",
};
const sizes: Record<Size, string> = {
  md: "h-9 px-3 text-body",
  lg: "h-12 px-5 text-lead", // patient-sized: 48px target
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium",
        "transition-[background-color,border-color,color,transform] duration-quick ease-pen active:translate-y-px",
        "disabled:pointer-events-none disabled:border-rule disabled:bg-sheet disabled:text-graphite",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
