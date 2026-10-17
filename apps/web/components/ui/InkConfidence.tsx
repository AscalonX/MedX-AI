import type { ReactNode } from "react";
import type { Lang } from "@medx/shared";
import { inkLevel } from "@medx/shared/src/tokens";
import { cx } from "./cx";

const textClass = { graphite: "text-graphite", inkSoft: "text-ink-soft", ink: "text-ink" } as const;

/**
 * Confidence as ink density (DIRECTION.md 6d). Never a percentage.
 * The hatch square goes from two pencil strokes (low) to solid ink (very high);
 * the value text darkens with it. Screen readers get the word.
 */
export function InkConfidence({
  confidence,
  lang,
  children,
  className,
}: {
  confidence: number;
  lang: Lang;
  children?: ReactNode;
  className?: string;
}) {
  const l = inkLevel(confidence);
  const label = { th: "ความมั่นใจ", it: "Affidabilità", en: "Confidence" }[lang];
  return (
    <span className={cx("inline-flex items-baseline gap-2", textClass[l.text], className)}>
      {children}
      <span role="img" aria-label={`${label}: ${l.label[lang]}`} title={`${label}: ${l.label[lang]}`} className="self-center">
        <InkSquare level={l.level} />
      </span>
    </span>
  );
}

function InkSquare({ level }: { level: 1 | 2 | 3 | 4 }) {
  // 12px square, strokes at 45deg. Level 4 is a filled square.
  const stroke = level === 1 ? "var(--color-graphite)" : level === 2 ? "var(--color-ink-soft)" : "var(--color-ink)";
  const forward = level === 1 ? [4, 10] : [2, 6, 10, 14];
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="block">
      <rect x="0.5" y="0.5" width="11" height="11" fill={level === 4 ? "var(--color-ink)" : "none"} stroke={stroke} strokeWidth="1" />
      {level < 4 && (
        <g stroke={stroke} strokeWidth="1">
          {forward.map((o) => (
            <line key={`f${o}`} x1={o - 6} y1="12" x2={o + 6} y2="0" />
          ))}
          {level === 3 && forward.map((o) => <line key={`b${o}`} x1={o - 6} y1="0" x2={o + 6} y2="12" />)}
        </g>
      )}
    </svg>
  );
}
