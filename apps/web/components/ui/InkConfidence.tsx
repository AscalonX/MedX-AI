import type { ReactNode } from "react";
import type { Lang } from "@medx/shared";
import { inkLevel } from "@medx/shared/src/tokens";
import { cx } from "./cx";

const textClass = { graphite: "text-graphite", inkSoft: "text-ink-soft", ink: "text-ink" } as const;

/**
 * Confidence as a 4-step level (DIRECTION.md 6d): rising bars, never a percentage.
 * Low confidence also softens the value text. Screen readers get the word.
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
    <span className={cx("inline-flex items-center gap-2", textClass[l.text], className)}>
      {children}
      <span role="img" aria-label={`${label}: ${l.label[lang]}`} title={`${label}: ${l.label[lang]}`} className="inline-flex h-3.5 items-end gap-[2px]">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cx("w-[3px] rounded-full", i <= l.level ? (l.level === 1 ? "bg-warn" : "bg-ocean") : "bg-rule")}
            style={{ height: 4 + i * 2.5 }}
          />
        ))}
      </span>
    </span>
  );
}
