import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { buildFontFaceCss } from "@/src/theme/fontFaces.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";

export const metadata: Metadata = {
  title: "Amandi & Tharindu",
  description:
    "Wedding website for Amandi Wijesundara and Tharindu Jayanetti — Monday, 14 December 2026.",
};

const DEFAULT_FONT_SANS =
  'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * Curated theme fonts (PRD P1-10), self-hosted via `@font-face` rules built
 * by `buildFontFaceCss()` (src/theme/fontFaces.js) from `public/fonts/` —
 * no Google Fonts request, so the site still works when that's unreachable.
 * The admin's font choice just selects the literal family name here.
 */
function fontFamilyFor(fontFamily: string): string {
  switch (fontFamily) {
    case "Cormorant Garamond":
    case "Playfair Display":
    case "Cinzel":
      return `'${fontFamily}', serif`;
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
  // getThemeSettings() hits the DB on every request; this must never throw,
  // or a transient DB hiccup takes down every page on the site.
  let settings;
  try {
    settings = await getThemeSettings();
  } catch (error) {
    console.error("getThemeSettings failed, falling back to defaults:", error);
    settings = { ...defaultThemeSettings };
  }

  const themeStyle: CSSProperties & Record<string, string> = {
    "--color-brand": settings.primaryColor,
    "--color-canvas": settings.secondaryColor,
    "--color-accent": settings.accentColor,
    "--color-accent-deep": settings.accentColor,
    "--font-sans": fontFamilyFor(settings.fontFamily),
    fontStyle: settings.fontStyle,
  };

  return (
    <html lang="en" style={themeStyle}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: buildFontFaceCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
