"use client";
import { useEffect, useRef, useState } from "react";
import { duration as dur, easing } from "@medx/shared/src/tokens";

const [, , x2, y2] = easing.pen;
// Cheap ease-out approximation of `pen` for a numeric tween (exact bezier not needed for a counter).
const ease = (t: number) => 1 - Math.pow(1 - t, 1 + 3 * (y2 - x2 + 0.4));

/**
 * Number that counts to `value`: from 0 on first appearance, then from the previous value on change.
 * Instant under prefers-reduced-motion. Screen readers get only the final value.
 * Digits are proportional in SCBXBeta2, so the visual number sits in a min-width box to avoid jitter.
 */
export function CountUp({
  value,
  durationMs = 900,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || durationMs <= dur.instant) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let id = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setShown(a + (value - a) * ease(t));
      if (t < 1) id = requestAnimationFrame(tick);
      else from.current = value;
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      from.current = value;
    };
  }, [value, durationMs]);

  const final = format(value);
  return (
    <span className={className}>
      <span aria-hidden="true" className="inline-block text-right" style={{ minWidth: `${final.length * 0.62}em` }}>
        {format(shown)}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
