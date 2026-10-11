import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { buildFontFaceCss } from "@/src/theme/fontFaces.js";
import { formatWeddingDate } from "@/src/theme/formatWeddingDate.js";
import { buildSectionGlassVars } from "@/src/theme/sectionTint.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";
import { ToastProvider } from "@/components/Toast";

// getThemeSettings() hits the DB on every request; this must never throw, or
// a transient DB hiccup takes down every page on the site.
async function loadThemeSettings() {
  try {
    return await getThemeSettings();
  } catch (error) {
    console.error("getThemeSettings failed, falling back to defaults:", error);
    return { ...defaultThemeSettings };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadThemeSettings();
  return {
    title: settings.coupleNames,
    description: `Wedding website for ${settings.coupleNames} — ${formatWeddingDate(settings.weddingDate)}.`,
  };
}

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
    case "EB Garamond":
    case "Lora":
    case "Libre Baskerville":
    case "Bodoni Moda":
    case "Marcellus":
    case "Cardo":
      return `'${fontFamily}', serif`;
    case "Great Vibes":
    case "Dancing Script":
    case "Parisienne":
      return `'${fontFamily}', cursive`;
    case "Montserrat":
    case "Josefin Sans":
    case "Raleway":
      return `'${fontFamily}', sans-serif`;
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
  const settings = await loadThemeSettings();

  const glass = buildSectionGlassVars(settings);

  const themeStyle: CSSProperties & Record<string, string> = {
    "--color-brand": settings.primaryColor,
    "--color-canvas": settings.secondaryColor,
    "--color-accent": settings.accentColor,
    "--color-accent-deep": settings.accentColor,
    "--color-text-base": settings.baseTextColor,
    "--color-text-inverted": settings.invertedTextColor,
    "--color-surface": settings.surfaceColor,
    "--font-sans": fontFamilyFor(settings.fontFamily),
    ...glass.vars,
    fontStyle: settings.fontStyle,
  };

  return (
    <html lang="en" style={themeStyle} data-glass={glass.enabled ? "on" : "off"}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: buildFontFaceCss() }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
