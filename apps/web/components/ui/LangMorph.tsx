"use client";
import { useEffect, useRef } from "react";
import type { Lang, Localized } from "@medx/shared";

/**
 * Language switch morphs text in place (DIRECTION.md 6e).
 * The first render is static; only a change of language or text re-inks.
 */
export function LangMorph({ text, lang, className }: { text: Localized | string; lang: Lang; className?: string }) {
  const value = typeof text === "string" ? text : text[lang];
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const animate = mounted.current;
  return (
    <span key={`${lang}:${value}`} lang={lang} className={[animate && "mx-morph", className].filter(Boolean).join(" ") || undefined}>
      {value}
    </span>
  );
}
