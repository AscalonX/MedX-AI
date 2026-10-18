"use client";
import { useEffect } from "react";
import type { Lang } from "@medx/shared";
import { MarketingNav, type MarketingNavLabels } from "../../components/ui";
import { LANDING_PATHS, LANG_STORAGE_KEY } from "./site";

/**
 * Client island for the sticky marketing nav. The landing language lives in the URL (/, /th, /it): choosing a
 * language writes medx.lang (so the staff app follows) and opens that page. English stays the default at "/".
 */
export function LandingNav({
  lang,
  links,
  cta,
  labels,
  onLangChange,
}: {
  lang: Lang;
  links: { href: string; label: string }[];
  cta: { href: string; label: string; hardNav?: boolean };
  labels: MarketingNavLabels;
  /** Client pages (e.g. /demo) switch in place instead of navigating. */
  onLangChange?: (l: Lang) => void;
}) {
  // The root layout renders <html lang="en">; keep the document language in step for screen readers.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const change = (l: Lang) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      /* storage blocked: the URL still carries the language */
    }
    if (onLangChange) onLangChange(l);
    else if (l !== lang) window.location.assign(LANDING_PATHS[l]);
  };

  return <MarketingNav links={links} cta={cta} lang={lang} onLangChange={change} labels={labels} homeHref={LANDING_PATHS[lang]} />;
}
