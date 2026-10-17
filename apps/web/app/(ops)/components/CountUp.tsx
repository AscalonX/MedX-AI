"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@medx/shared";
import { locale } from "../i18n";

/** Animate only on mount, never on five-second refreshes or language changes. */
export function useCountProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const start = performance.now();
    const finish = () => { cancelAnimationFrame(frame); setProgress(1); };
    const tick = (now: number) => {
      const fraction = Math.min(1, (now - start) / 650);
      setProgress(1 - Math.pow(1 - fraction, 3));
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    const change = () => { if (preference.matches) finish(); };
    if (preference.matches) finish();
    else frame = requestAnimationFrame(tick);
    preference.addEventListener("change", change);
    return () => { cancelAnimationFrame(frame); preference.removeEventListener("change", change); };
  }, []);
  return progress;
}

export function CountUp({ value, lang }: { value: number; lang: Lang }) {
  const progress = useCountProgress();
  const format = new Intl.NumberFormat(locale[lang]);
  return <span aria-label={format.format(value)}><span aria-hidden="true">{format.format(Math.round(value * progress))}</span></span>;
}
