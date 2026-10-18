import { LOCKUP_COLOR, LOCKUP_WHITE, MARK_TILE } from "./logoSvg";
import { cx } from "./cx";

/**
 * MedX logo (DIRECTION.md section 13, "Echo X"). Vector only, no font dependency. Small sizes and favicons stay
 * vector; the 3D mark (`FinArt art="mark"`) is only for large marketing moments.
 * `lockup`: tile + wordmark (default). `mark`: tile only. `white` for gradient or dark backgrounds.
 * Source: docs/design/logo/build.py (static, trusted SVG strings in ./logoSvg).
 */
export function Logo({
  variant = "lockup",
  tone = "color",
  height = 32,
  className,
}: {
  variant?: "lockup" | "mark";
  tone?: "color" | "white";
  height?: number;
  className?: string;
}) {
  const svg = variant === "mark" ? MARK_TILE : tone === "white" ? LOCKUP_WHITE : LOCKUP_COLOR;
  return (
    <span
      role="img"
      aria-label="MedX"
      className={cx("inline-flex shrink-0 [&>svg]:h-full [&>svg]:w-auto", className)}
      style={{ height }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
