import type { ReactNode } from "react";
import { cx } from "./cx";

const tones = {
  plain: "bg-sheet text-ink-soft shadow-hairline ring-1 ring-inset ring-rule",
  glass: "glass text-ink shadow-hairline ring-1 ring-inset ring-sheet/70",
  ocean: "bg-ocean-tint text-ocean",
  teal: "bg-teal-tint text-teal",
  dark: "bg-on-primary/10 text-on-primary ring-1 ring-inset ring-on-primary/20",
} as const;
const sizes = { sm: "min-h-7 gap-1.5 px-3 py-1 text-micro", md: "min-h-9 gap-2 px-4 py-1.5 text-small" } as const;

/**
 * Static pill label for marketing surfaces: trust chips ("Synthetic data only"), "Try saying" phrases, the
 * built-with strip and "under the hood" lists. Not a status: clinical states use `Badge` / `FieldValue`, filters use
 * `Pill`. Never red. Pass `lang` for a phrase in another language so Thai line rules and voices apply.
 */
export function Chip({
  children,
  icon,
  tone = "plain",
  size = "md",
  lang,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
  lang?: string;
  className?: string;
}) {
  return (
    <span lang={lang} className={cx("inline-flex w-fit max-w-full items-center rounded-full font-semibold", tones[tone], sizes[size], className)}>
      {icon && <span aria-hidden="true" className="inline-flex shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
