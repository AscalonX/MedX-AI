import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai, Newsreader, Noto_Serif_Thai } from "next/font/google";
import "./globals.css";

// Latin faces first; Thai faces load only the thai subset, so the browser falls back per glyph.
// Italian needs only the latin subset (à è é ì ò ù); latin-ext covers names.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});
const notoSerifThai = Noto_Serif_Thai({
  variable: "--font-noto-serif-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
const plexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-sans-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600"],
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
    <html
      lang="en"
      className={`${newsreader.variable} ${notoSerifThai.variable} ${plexSans.variable} ${plexSansThai.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
