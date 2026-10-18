import type { MetadataRoute } from "next";
import { SITE_URL } from "./_landing/site";

/**
 * Index the marketing pages only. Staff surfaces and the API stay out of search. /demo/<persona> is disallowed
 * because opening it starts a synthetic demo case (a crawler running scripts would create sessions).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/th", "/it", "/demo"],
        disallow: ["/review", "/pharmacy", "/ops", "/api", "/home", "/demo/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
