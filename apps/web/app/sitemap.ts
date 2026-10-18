import type { MetadataRoute } from "next";
import { LANDING_PATHS, SITE_URL } from "./_landing/site";

/** Public marketing pages: the landing in three languages and the persona hub. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (p: string) => `${SITE_URL}${p === "/" ? "" : p}`;
  const languages = { en: url(LANDING_PATHS.en), th: url(LANDING_PATHS.th), it: url(LANDING_PATHS.it) };
  return [
    { url: url(LANDING_PATHS.en), changeFrequency: "weekly", priority: 1, alternates: { languages } },
    { url: url(LANDING_PATHS.th), changeFrequency: "weekly", priority: 0.8, alternates: { languages } },
    { url: url(LANDING_PATHS.it), changeFrequency: "weekly", priority: 0.8, alternates: { languages } },
    { url: url("/demo"), changeFrequency: "weekly", priority: 0.7 },
  ];
}
