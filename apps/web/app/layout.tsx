import type { Metadata } from "next";
import { Anuphan, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// v2: one geometric sans. Plus Jakarta Sans for Latin (Italian needs only `latin`; latin-ext covers names),
// Anuphan for Thai (loads only the thai subset; the browser falls back per glyph).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
});
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MedX Bridge",
  description: "Multilingual pre-visit intake that supports clinician review. Research prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${anuphan.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
