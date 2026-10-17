"use client";
import { memo } from "react";
import { LangMorph } from "@/components/ui";

/**
 * LangMorph reads a ref during render, so any parent re-render (our 5 s polling) would replay the ink-in
 * animation on unchanged text. Memoising on content means it re-renders, and morphs, only when text or language change.
 */
export const Morph = memo(LangMorph, (a, b) => a.lang === b.lang && a.className === b.className && JSON.stringify(a.text) === JSON.stringify(b.text));
