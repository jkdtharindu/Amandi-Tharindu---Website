import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Cormorant_Garamond, Playfair_Display, EB_Garamond } from "next/font/google";
import "./globals.css";
import { getThemeSettings } from "@/src/admin/themeRepo.js";

export const metadata: Metadata = {
  title: "Amandi & Tharindu",
  description:
    "Wedding website for Amandi Wijesundara and Tharindu Jayanetti — Monday, 14 December 2026.",
};

/**
 * Curated theme fonts (PRD P1-10). next/font requires each font's loader to
 * be a static top-level call, so every option is loaded unconditionally —
 * the admin's choice just selects which one's CSS variable `--font-sans`
 * points to (see `fontVarFor` below).
 */
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
});

const DEFAULT_FONT_SANS =
  'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function fontVarFor(fontFamily: string): string {
  switch (fontFamily) {
    case "Cormorant Garamond":
      return "var(--font-cormorant), serif";
    case "Playfair Display":
      return "var(--font-playfair), serif";
    case "EB Garamond":
      return "var(--font-eb-garamond), serif";
    default:
      return DEFAULT_FONT_SANS;
  }
}

/**
 * Document shell only. The public wedding chrome (header/footer) lives in
 * `app/(public)/layout.tsx` so that `/admin` can render its own chrome
 * instead of the guest-facing one.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getThemeSettings();

  const themeStyle: CSSProperties & Record<string, string> = {
    "--color-brand": settings.primaryColor,
    "--color-canvas": settings.secondaryColor,
    "--color-accent": settings.accentColor,
    "--color-accent-deep": settings.accentColor,
    "--font-sans": fontVarFor(settings.fontFamily),
    fontStyle: settings.fontStyle,
  };

  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${playfairDisplay.variable} ${ebGaramond.variable}`}
      style={themeStyle}
    >
      <body>{children}</body>
    </html>
  );
}
