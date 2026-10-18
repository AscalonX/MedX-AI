import type { ReactNode } from "react";
import { cx } from "./cx";

/*
 * Marketing section pattern (DIRECTION.md 12): eyebrow chip, big two-tone title, subtitle, then content.
 * Sentence case everywhere (no all caps). Only for marketing pages; the app keeps CardHeader.
 */

type Tone = "light" | "dark";

/** Small pill label above a title. Sentence case. `tone="dark"` on the ink surface or the brand gradient. */
export function Eyebrow({ children, icon, tone = "light", className }: { children: ReactNode; icon?: ReactNode; tone?: Tone; className?: string }) {
  return (
    <p
      className={cx(
        "inline-flex h-7 w-fit items-center gap-1.5 rounded-full px-3 text-eyebrow font-semibold",
        tone === "light" ? "bg-sheet/85 text-teal shadow-hairline ring-1 ring-inset ring-rule" : "bg-on-primary/10 text-on-primary ring-1 ring-inset ring-on-primary/20",
        className,
      )}
    >
      {icon ?? <span aria-hidden="true" className={cx("size-1.5 rounded-full", tone === "light" ? "bg-primary-gradient" : "bg-on-primary/80")} />}
      {children}
    </p>
  );
}

/** Second tone of a two-tone headline: "Every word, <Accent>understood.</Accent>". Large text only. */
export function Accent({ children, tone = "light" }: { children: ReactNode; tone?: Tone }) {
  return <span className={tone === "light" ? "text-brand-gradient" : "text-brand-gradient-light"}>{children}</span>;
}

/** Eyebrow, title, subtitle. `size="hero"` for the page H1, `"h2"` for sections. */
export function SectionHeader({
  id,
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  align = "center",
  as: Tag = "h2",
  size = "h2",
  tone = "light",
  action,
  className,
}: {
  /** id of the heading element (for aria-labelledby). */
  id?: string;
  eyebrow?: ReactNode;
  eyebrowIcon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  as?: "h1" | "h2" | "h3";
  size?: "hero" | "h2" | "h3";
  tone?: Tone;
  /** Optional buttons under the subtitle. */
  action?: ReactNode;
  className?: string;
}) {
  const center = align === "center";
  return (
    <header className={cx("flex flex-col gap-4", center ? "mx-auto items-center text-center" : "items-start text-left", className)}>
      {eyebrow && (
        <Eyebrow tone={tone} icon={eyebrowIcon}>
          {eyebrow}
        </Eyebrow>
      )}
      <Tag
        id={id}
        className={cx(
          "font-extrabold",
          size === "hero" ? "text-hero" : size === "h2" ? "text-h2" : "text-h3",
          center ? "max-w-[22ch]" : "max-w-[24ch]",
          tone === "light" ? "text-ink" : "text-on-primary",
        )}
      >
        {title}
      </Tag>
      {subtitle && (
        <p className={cx("max-w-[62ch] text-lead-lg", tone === "light" ? "text-ink-soft" : "text-on-primary/80")}>{subtitle}</p>
      )}
      {action && <div className={cx("mt-2 flex flex-wrap gap-3", center && "justify-center")}>{action}</div>}
    </header>
  );
}

const panels = {
  plain: "",
  // White glass panel over the mist (e.g. "Phone and web, one record").
  panel: "glass rounded-bento border border-sheet/70 px-5 py-12 shadow-sheet sm:px-10 sm:py-16",
  // The ink band (e.g. "Safety by design"). One per page. Never red.
  ink: "rounded-bento bg-ink-gradient px-5 py-14 text-on-primary shadow-ink sm:px-12 sm:py-20",
} as const;

/**
 * A page section: full-width band, centred 1200px column, generous vertical rhythm (`py-section`).
 * Give `id` (anchor target) and `title`: the heading gets `${id}-title` and labels the section.
 */
export function Section({
  id,
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  align = "center",
  tone = "plain",
  headerAction,
  reveal = true,
  "aria-label": ariaLabel,
  className,
  innerClassName,
  children,
}: {
  id?: string;
  eyebrow?: ReactNode;
  eyebrowIcon?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  tone?: keyof typeof panels;
  headerAction?: ReactNode;
  /** Fade the header up on scroll (CSS only, off under reduced motion). */
  reveal?: boolean;
  /** Accessible name when there is no visible title. */
  "aria-label"?: string;
  className?: string;
  innerClassName?: string;
  children?: ReactNode;
}) {
  const titleId = id && title ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={titleId} aria-label={titleId ? undefined : ariaLabel} className={cx("px-4 py-section sm:px-8", className)}>
      <div className={cx("mx-auto w-full max-w-page", panels[tone], innerClassName)}>
        {title && (
          <SectionHeader
            id={titleId}
            eyebrow={eyebrow}
            eyebrowIcon={eyebrowIcon}
            title={title}
            subtitle={subtitle}
            align={align}
            tone={tone === "ink" ? "dark" : "light"}
            action={headerAction}
            className={cx("mb-10 sm:mb-14", reveal && "mx-reveal")}
          />
        )}
        {children}
      </div>
    </section>
  );
}
