import type { ReactNode } from "react";
import { cx } from "./cx";

type Tone = "ink" | "outline" | "pencil" | "signal" | "signalOutline";

const tones: Record<Tone, string> = {
  ink: "bg-ink text-sheet border-ink",
  outline: "text-ink border-ink",
  pencil: "text-graphite border-dashed border-graphite",
  signal: "bg-signal text-on-signal border-signal", // emergency only
  signalOutline: "bg-signal-tint text-ink border-signal", // urgent
};

/** Small status label. Sentence case, never all caps, never a coloured dot. */
export function Badge({ tone = "outline", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-5 items-center rounded-control border px-1.5 text-micro font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
