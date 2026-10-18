import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

const tones = {
  // White card: radius 22, diffuse navy shadow, hairline border. The default container.
  default: "border border-rule/70 bg-sheet shadow-sheet",
  // Translucent card for marketing surfaces over the mist background (never for clinical content).
  glass: "glass border border-sheet/70 shadow-sheet",
  // Dark card on the ink token (DIRECTION.md 12). Marketing only: one per page section, never red, never clinical.
  ink: "bg-ink-gradient text-on-primary shadow-ink",
} as const;

/** White card: radius 22, diffuse navy shadow, hairline border. The default container. */
export function Card({
  padded = true,
  interactive = false,
  tone = "default",
  className,
  children,
  ...rest
}: { padded?: boolean; interactive?: boolean; tone?: keyof typeof tones; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-card",
        tones[tone],
        padded && "p-5",
        // Hover lift (DIRECTION.md 5): rises 3px and fades in the lifted shadow; pointer devices, no reduced motion.
        interactive && cx("mx-lift", tone === "ink" && "mx-lift-ink"),
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Card header row: title left, optional action right. */
export function CardHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="text-lead font-bold text-ink">{title}</h2>
      {action}
    </div>
  );
}
