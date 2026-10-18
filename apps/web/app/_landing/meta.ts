import type { Metadata } from "next";
import type { Lang } from "@medx/shared";
import { LANDING_COPY } from "./copy";
import { LANDING_PATHS } from "./site";

/** Per-language landing metadata. The Open Graph image comes from app/opengraph-image.png (file convention). */
export function landingMetadata(lang: Lang): Metadata {
  const t = LANDING_COPY[lang].meta;
  const alternates = { canonical: LANDING_PATHS[lang], languages: { en: LANDING_PATHS.en, th: LANDING_PATHS.th, it: LANDING_PATHS.it, "x-default": LANDING_PATHS.en } };
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates,
    openGraph: { type: "website", siteName: "MedX", url: LANDING_PATHS[lang], title: t.title, description: t.description, locale: t.locale },
    twitter: { card: "summary_large_image", title: t.title, description: t.description },
  };
}
