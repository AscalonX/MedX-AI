import { cx } from "./cx";

/** Initials on the brand gradient. No stock photos. */
export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      role="img"
      aria-label={name}
      className={cx("grid shrink-0 place-items-center rounded-full bg-primary-gradient font-bold text-on-primary ring-2 ring-sheet", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}
