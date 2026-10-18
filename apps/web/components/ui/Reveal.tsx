import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type RevealTag = "div" | "section" | "ul" | "ol" | "li" | "figure" | "article" | "header" | "p" | "span";

/**
 * Scroll reveal (DIRECTION.md 5): the block fades up 14px when it enters the viewport.
 * `stagger` reveals the direct children one after another (70ms apart) instead of the block as one.
 * `delay` adds a fixed wait in ms. Works in server components: it only sets classes; the shared IntersectionObserver
 * lives in `MotionRuntime` (app/layout.tsx). Content is visible without JS and under reduced motion, and a block that
 * holds urgent content (a red flag, an alert) is never hidden or delayed.
 */
export function Reveal({
  as: Tag = "div",
  stagger = false,
  delay,
  className,
  style,
  children,
  ...rest
}: {
  as?: RevealTag;
  stagger?: boolean;
  /** Extra delay in ms before the reveal. */
  delay?: number;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">) {
  const s = delay ? ({ ...style, "--mx-delay": `${Math.max(0, Math.round(delay))}ms` } as CSSProperties) : style;
  return (
    <Tag className={cx("mx-reveal", stagger && "mx-reveal-stagger", className)} style={s} {...rest}>
      {children}
    </Tag>
  );
}
