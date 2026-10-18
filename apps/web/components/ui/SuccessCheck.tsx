import { cx } from "./cx";

const tones = {
  // Done by a person (approved, signed off, dispensed): teal, DIRECTION.md 2.
  teal: "bg-teal text-on-primary",
  // On the brand gradient or ink: white disc, teal tick.
  light: "bg-sheet text-teal",
} as const;

/**
 * Success tick for receipts, approvals and sign-offs (DIRECTION.md 6f): the disc pops in, then the tick draws itself
 * (CSS `.mx-check-disc` / `.mx-check-path`, 360 + 450 ms). Static under reduced motion. Decorative: the words next to
 * it carry the meaning. Never for urgent or red content.
 */
export function SuccessCheck({ size = 40, tone = "teal", className }: { size?: number; tone?: keyof typeof tones; className?: string }) {
  const icon = Math.round(size * 0.5);
  return (
    <span aria-hidden="true" className={cx("mx-check-disc grid shrink-0 place-items-center rounded-full", tones[tone], className)} style={{ width: size, height: size }}>
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path className="mx-check-path" d="M20 6 9 17l-5-5" pathLength={1} />
      </svg>
    </span>
  );
}
