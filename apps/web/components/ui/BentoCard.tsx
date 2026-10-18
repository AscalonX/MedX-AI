import Image from "next/image";
import type { ReactNode } from "react";
import { cx } from "./cx";

/*
 * Features bento (DIRECTION.md 12). Rules:
 * - Every card shows the real product: a `BentoMedia` crop of a real screen, or real UI rendered by the page.
 *   No generic icon-only cards, no stock art, no Fin.
 * - Exactly one `tone="ink"` card per grid (the lead feature). It is never red.
 * - `accent="signal"` (red icon disc and label) is allowed on ONE card only: the red-flag feature card.
 */

/** 1 column on phones, 2 from 640px, 3 from 1024px. Cards span with `cols` / `rows`. */
export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5", className)}>{children}</div>;
}

const colSpan = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-2 lg:col-span-3" } as const;
const rowSpan = { 1: "", 2: "lg:row-span-2" } as const;
const accents = {
  ocean: { disc: "bg-ocean-tint text-ocean", label: "text-ocean" },
  teal: { disc: "bg-teal-tint text-teal", label: "text-teal" },
  // Red-flag feature card only. Red means urgency, never decoration.
  signal: { disc: "bg-signal-tint text-signal", label: "text-signal" },
} as const;

export function BentoCard({
  title,
  body,
  eyebrow,
  icon,
  tone = "light",
  accent = "ocean",
  media,
  mediaPosition = "bottom",
  cols = 1,
  rows = 1,
  titleAs: Title = "h3",
  className,
  children,
}: {
  title: ReactNode;
  body?: ReactNode;
  /** Short label above the title, e.g. "Pharmacist 1". */
  eyebrow?: ReactNode;
  /** Small icon in a tinted rounded square (decorative). */
  icon?: ReactNode;
  /** "ink": the one dark card of the grid. */
  tone?: "light" | "ink";
  /** Icon disc and eyebrow colour on light cards. "signal" is for the red-flag card only. Ignored on ink. */
  accent?: keyof typeof accents;
  /** Real UI: usually <BentoMedia />. */
  media?: ReactNode;
  /** "right" puts the media beside the text from 1024px (wide cards). */
  mediaPosition?: "bottom" | "right";
  cols?: keyof typeof colSpan;
  rows?: keyof typeof rowSpan;
  titleAs?: "h3" | "h4";
  className?: string;
  /** Extra content under the body (chips, a link). */
  children?: ReactNode;
}) {
  const dark = tone === "ink";
  const a = accents[accent];
  return (
    <article
      className={cx(
        // Reveal on scroll and hover lift (DIRECTION.md 5): rises 3px, the lifted shadow fades in, the crop zooms 3.5%.
        "mx-reveal mx-lift relative flex flex-col rounded-bento p-6 sm:p-7",
        dark ? "mx-lift-ink bg-ink-gradient text-on-primary shadow-ink" : "border border-rule/70 bg-sheet shadow-sheet",
        mediaPosition === "right" && "lg:flex-row lg:items-center lg:gap-8",
        colSpan[cols],
        rowSpan[rows],
        className,
      )}
    >
      <div className={cx("flex flex-col gap-3", mediaPosition === "right" && "lg:w-[44%] lg:shrink-0")}>
        {(icon || eyebrow) && (
          <div className="flex items-center gap-2.5">
            {icon && (
              <span
                aria-hidden="true"
                className={cx("grid size-10 shrink-0 place-items-center rounded-2xl", dark ? "bg-on-primary/10 text-on-primary ring-1 ring-inset ring-on-primary/20" : a.disc)}
              >
                {icon}
              </span>
            )}
            {eyebrow && <span className={cx("text-small font-semibold", dark ? "text-on-primary/80" : a.label)}>{eyebrow}</span>}
          </div>
        )}
        <Title className={cx("text-h3 font-bold", dark ? "text-on-primary" : "text-ink")}>{title}</Title>
        {body && <p className={cx("max-w-[56ch] text-body", dark ? "text-on-primary/80" : "text-ink-soft")}>{body}</p>}
        {children}
      </div>
      {media && <div className={cx("min-w-0", mediaPosition === "right" ? "mt-6 lg:mt-0 lg:flex-1" : "mt-auto pt-6")}>{media}</div>}
    </article>
  );
}

/**
 * A crop of a real MedX screen (public/landing/*.webp), framed like a device window.
 * `alt` must say what the screen shows. `position` picks the crop (CSS object-position), e.g. "top left".
 * `zoom` (1 to 3) enlarges the screen around `position`, so one panel of a full-screen capture stays legible
 * in a small card (text in a crop should render at 11px or more).
 * `chrome` adds a neutral window bar (grey dots, never red/amber/green traffic lights).
 * Inside a `BentoCard` the screen zooms slightly while the card is hovered (`mx-zoom`, pointer devices only).
 */
export function BentoMedia({
  src,
  alt,
  aspect = "16 / 10",
  position = "top left",
  sizes = "(min-width: 1024px) 560px, (min-width: 640px) 50vw, 100vw",
  tone = "light",
  chrome = false,
  zoom = 1,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  aspect?: string;
  position?: string;
  sizes?: string;
  /** "ink" when the media sits on the dark card. */
  tone?: "light" | "ink";
  chrome?: boolean;
  zoom?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={cx("mx-media m-0 flex flex-col", tone === "ink" && "mx-media-ink", className)}>
      {chrome && (
        <span aria-hidden="true" className="flex h-7 shrink-0 items-center gap-1.5 border-b border-rule/70 bg-sheet px-3">
          <span className="size-2 rounded-full bg-rule" />
          <span className="size-2 rounded-full bg-rule" />
          <span className="size-2 rounded-full bg-rule" />
        </span>
      )}
      <span className="relative block w-full overflow-hidden" style={{ aspectRatio: aspect }}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="mx-zoom object-cover"
          style={{ objectPosition: position, transformOrigin: position, ...(zoom > 1 ? { transform: `scale(${Math.min(zoom, 3)})` } : null) }}
        />
      </span>
    </figure>
  );
}
