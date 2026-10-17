"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Lang } from "@medx/shared";
import { duration } from "@medx/shared/src/tokens";
import { segments, type Mark } from "./segments";
import { cx } from "./cx";

/**
 * One patient turn with its evidence marks (DIRECTION.md 6a).
 * Pass every evidence span for this turn; set `active` on the spans of the selected field.
 * When a span turns active the turn scrolls into view, then the highlighter sweeps.
 * Inactive evidence shows as a faint dotted underline: "this sentence was used somewhere".
 */
export function EvidenceHighlight({
  text,
  lang,
  marks,
  className,
}: {
  text: string;
  lang: Lang;
  marks: Mark[];
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const segs = segments(text, marks);
  const anyActive = segs.some((s) => s.mark?.active);
  // Marks paint inactive first, then arm on the next frame, so a turn that mounts already active still sweeps.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!anyActive || !armed) return;
    const first = ref.current?.querySelector('mark[data-active="true"]');
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    first?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [anyActive, armed]);

  return (
    <p ref={ref} lang={lang} className={cx("text-body text-ink", className)}>
      {segs.map((s, i) =>
        s.mark ? (
          <mark
            key={i}
            className={cx("mx-mark", !s.mark.active && "underline decoration-dotted decoration-ocean/60 decoration-[1.5px] underline-offset-4")}
            data-active={armed && s.mark.active}
            style={
              s.mark.active
                ? ({ "--mx-sweep-delay": `${duration.scroll + s.mark.order * duration.sweepStagger}ms` } as CSSProperties)
                : undefined
            }
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}
