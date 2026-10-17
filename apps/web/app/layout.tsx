import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Owner decision: SCBXBeta2 is the single typeface (Latin, Italian accents, Thai). Weights by role: 300/400/700.
// The font has no `tnum` feature: digits are proportional (see DIRECTION.md section 3).
const scbx = localFont({
  variable: "--font-scbx",
  display: "swap",
  src: [
    { path: "./fonts/SCBXBeta2-Light.otf", weight: "300", style: "normal" },
    { path: "./fonts/SCBXBeta2-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/SCBXBeta2-Bold.otf", weight: "700", style: "normal" },
  ],
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Noto Sans Thai", "sans-serif"],
});

export const metadata: Metadata = {
  title: "MedX",
  description: "Multilingual pre-visit intake that supports clinician review. Research prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={scbx.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
