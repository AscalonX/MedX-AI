"use client";
import Image, { type ImageLoader } from "next/image";
import type { CSSProperties } from "react";
import { cx } from "./cx";

/**
 * Owner-approved 3D brand art (DIRECTION.md section 11, "3D art"). Files live in public/brand/ (webp, transparent).
 * - Poses (`wave`, `listening`, `thinking`, `happy`, `pointing`): the 3D Fin for empty, done and voice states.
 * - `hero-wave`, `hero-hello`: the large detailed Fin for the landing hero and covers (240px and up).
 * - `mark`: the 3D Echo X mark for the final call to action. The vector `Logo` stays the logo everywhere else.
 * Use at 96px and up; below that use the vector `Mascot` / `Logo`. Never on red-flag, alert, error or clinical content.
 * Decorative by default (empty alt + aria-hidden). Pass `label` only when the art carries meaning on its own.
 */
export type FinArtName = "wave" | "listening" | "thinking" | "happy" | "pointing" | "hero-wave" | "hero-hello" | "mark";

/** Files per art: nominal size suffix and the real pixel width of that file (the "512" poses are cropped). */
const ART: Record<FinArtName, { base: string; files: ReadonlyArray<readonly [suffix: number, px: number]> }> = {
  wave: { base: "fin3d-wave", files: [[256, 256], [512, 372]] },
  listening: { base: "fin3d-listening", files: [[256, 256], [512, 417]] },
  thinking: { base: "fin3d-thinking", files: [[256, 256], [512, 409]] },
  happy: { base: "fin3d-happy", files: [[256, 256], [512, 391]] },
  pointing: { base: "fin3d-pointing", files: [[256, 256], [512, 379]] },
  "hero-wave": { base: "fin-wave", files: [[256, 256], [512, 512], [1024, 847]] },
  "hero-hello": { base: "fin-hello", files: [[256, 256], [512, 512], [1024, 820]] },
  mark: { base: "mark-3d", files: [[256, 256], [512, 512]] },
};

/** Smallest file at least as wide as the requested width, else the largest. Pure: no optimizer needed. */
export function finArtSrc(art: FinArtName, width: number): string {
  const { base, files } = ART[art];
  const pick = files.find(([, px]) => px >= width) ?? files[files.length - 1]!;
  return `/brand/${base}-${pick[0]}.webp`;
}

const loaders = Object.fromEntries(
  (Object.keys(ART) as FinArtName[]).map((a) => [a, (({ width }) => finArtSrc(a, width)) satisfies ImageLoader]),
) as Record<FinArtName, ImageLoader>;

export function FinArt({
  art,
  size,
  label,
  priority = false,
  className,
  style,
}: {
  art: FinArtName;
  /** Rendered CSS size in px (the art is square). Keep it explicit so the layout never shifts. */
  size: number;
  /** Accessible name. Omit for decorative use (the default). */
  label?: string;
  /** Only for the landing hero (above the fold, LCP). Everything else loads lazily. */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Image
      src={`/brand/${ART[art].base}.webp`}
      loader={loaders[art]}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      priority={priority}
      draggable={false}
      className={cx("mascot-3d select-none", className)}
      style={style}
    />
  );
}
