import type { CSSProperties, ReactNode } from "react";
import { FinArt, type FinArtName } from "./FinArt";
import { PointerParallax } from "./PointerParallax";
import { cx } from "./cx";

/** Parallax depth in px for a `mx-depth` layer (how far it drifts at the screen edge), and an entrance delay in ms
 * for the card inside (`mx-enter-child`). */
const depth = (px: number, enterMs?: number) => ({ "--mx-depth": px, ...(enterMs ? { "--mx-child-delay": `${enterMs}ms` } : null) }) as CSSProperties;

/**
 * Landing hero art (DIRECTION.md 12): the large 3D Fin on a soft light disc with faint echo rings, and up to three
 * floating PATIENT-SIDE cards (`FloatCard`) around it. This is the only place Fin appears on "/".
 * Cards show real patient-app UI only (language choice, a question, the patient code, "answers sent").
 * Never a red flag, an alert, a clinical summary or a "Needs check" chip next to Fin.
 * The third card hides below 640px so the phone layout stays calm.
 *
 * Motion (DIRECTION.md 5; all off under reduced motion): the stage fades and settles in, Fin floats with a slight tilt,
 * each card bobs on its own period and arrives a beat after the last, and on desktop the layers drift with the
 * pointer at different depths (Fin with it, the cards against it).
 */
export function FinStage({
  art = "hero-hello",
  size = 360,
  priority = true,
  label,
  cards = [],
  className,
}: {
  art?: Extract<FinArtName, "hero-hello" | "hero-wave" | "wave">;
  /** Intrinsic size hint for the image (it scales to 78% of the stage). */
  size?: number;
  /** The hero art is the LCP image: priority by default. */
  priority?: boolean;
  label?: string;
  cards?: ReactNode[];
  className?: string;
}) {
  const [a, b, c] = cards;
  return (
    <PointerParallax className={cx("relative mx-auto grid aspect-square w-full max-w-[480px] place-items-center", className)}>
      <span aria-hidden="true" className="mx-depth absolute inset-[4%] rounded-full bg-halo" style={depth(4)} />
      <span aria-hidden="true" className="mx-depth absolute inset-[14%] rounded-full ring-1 ring-ocean/10" style={depth(6)} />
      <span aria-hidden="true" className="absolute inset-0 rounded-full ring-1 ring-ocean/[0.06]" />
      <span className="mx-depth mx-enter-pop mx-d1 relative block w-[78%]" style={depth(10)}>
        <span className="mx-fin-float block">
          <FinArt art={art} size={size} priority={priority} label={label} className="h-auto w-full drop-shadow-[0_28px_32px_rgba(15,45,80,0.22)]" />
        </span>
      </span>
      {a && (
        <div className="mx-float mx-depth mx-enter-child absolute left-0 top-[4%] max-w-[64%]" style={depth(-14, 300)}>
          {a}
        </div>
      )}
      {b && (
        <div className="mx-float mx-float-delay-1 mx-depth mx-enter-child absolute right-0 top-[60%] max-w-[60%] sm:top-[46%]" style={depth(-20, 420)}>
          {b}
        </div>
      )}
      {c && (
        <div className="mx-float mx-float-delay-2 mx-depth mx-enter-child absolute bottom-[2%] left-[2%] hidden max-w-[64%] sm:block" style={depth(-10, 540)}>
          {c}
        </div>
      )}
    </PointerParallax>
  );
}

/** A small glass card floating around the hero art. Patient-side content only (see FinStage). */
export function FloatCard({
  icon,
  meta,
  title,
  lang,
  children,
  className,
}: {
  /** Decorative icon on the brand gradient. */
  icon?: ReactNode;
  /** Small line above, e.g. "Fin is listening". */
  meta?: ReactNode;
  title?: ReactNode;
  lang?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div lang={lang} className={cx("glass flex items-center gap-3 rounded-2xl border border-sheet/80 px-3.5 py-3 shadow-float", className)}>
      {icon && (
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-gradient text-on-primary">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        {meta && <p className="text-micro text-ink-soft">{meta}</p>}
        {title && <p className="text-small font-bold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}
