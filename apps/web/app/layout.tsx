import type { Metadata, Viewport } from "next";
import { color } from "@medx/shared/src/tokens";
import { fontVariables } from "@/components/ui/fonts";
import { MotionRuntime } from "@/components/ui/MotionRuntime";
import { SITE_URL } from "./_landing/site";
import "./globals.css";

// Web typefaces v3.1 (owner decisions, 17 and 18 Oct 2026; DIRECTION.md section 3): Plus Jakarta Sans for Latin and
// Italian, Noto Sans Thai for Thai, self-hosted by next/font/google (fonts.ts). They are the only UI fonts on the web:
// SCBXBeta2 is not loaded and not in the CSS stack. The logo stays an outlined vector.
// Motion (DIRECTION.md section 5): MotionRuntime runs the scroll reveals and the page fade on client navigations.
// data-scroll-behavior="smooth" lets Next.js turn smooth scrolling off during route changes (marketing pages scroll
// smoothly to in-page anchors; globals.css).

const title = "MedX: every word, understood";
const description =
  "Multilingual pre-visit intake that supports clinicians. Patients speak Thai, Italian or English, every field cites their words, red flags are code, and clinicians decide. Research prototype, synthetic data only.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s · MedX" },
  description,
  applicationName: "MedX",
  // The Open Graph image is app/opengraph-image.png (file convention: 1200x630, rendered from pitch/cover/cover-v5-og.html by
  // pitch/cover/render-og.mjs: no clinical or red-flag chip beside Fin, a synthetic-data line, no model claim).
  openGraph: { type: "website", siteName: "MedX", title, description, url: "/", locale: "en_US", alternateLocale: ["th_TH", "it_IT"] },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: color.desk,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} data-scroll-behavior="smooth">
      <body className="antialiased">
        {children}
        <MotionRuntime />
      </body>
    </html>
  );
}
