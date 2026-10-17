import type { ReactNode } from "react";
import { cx } from "./cx";

type Tone = "ink" | "outline" | "pencil" | "signal" | "signalOutline" | "teal" | "ocean";

const tones: Record<Tone, string> = {
  ink: "bg-ink text-sheet",
  outline: "bg-sheet text-ink-soft ring-1 ring-inset ring-rule",
  pencil: "bg-warn-tint text-warn border border-dashed border-warn/60", // needs check
  signal: "bg-signal text-on-signal", // emergency only
  signalOutline: "bg-signal-tint text-signal", // urgent
  teal: "bg-teal-tint text-teal", // approved, edited, done
  ocean: "bg-ocean-tint text-ocean", // from patient's words
};

/** Small status chip. Sentence case, pill, optional leading icon. Never a bare coloured dot. */
export function Badge({ tone = "outline", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-micro font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
