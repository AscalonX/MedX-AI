"use client";
import { useRef } from "react";
import type { Lang, Localized } from "@medx/shared";

/**
 * Language switch morphs text in place (DIRECTION.md 6e).
 * Animates only a node born from a real change of text or language. The first render is static and
 * unrelated parent re-renders never replay the animation (the class never toggles on a live node).
 */
export function LangMorph({ text, lang, className }: { text: Localized | string; lang: Lang; className?: string }) {
  const value = typeof text === "string" ? text : text[lang];
  const key = `${lang}:${value}`;
  const initial = useRef(key);
  const changed = useRef(false);
  if (key !== initial.current) changed.current = true; // idempotent: only ever flips false -> true
  return (
    <span key={key} lang={lang} className={[changed.current && "mx-morph", className].filter(Boolean).join(" ") || undefined}>
      {value}
    </span>
  );
}
