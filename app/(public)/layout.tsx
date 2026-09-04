import type { ReactNode } from "react";
import SiteHeader from "@/components/public/SiteHeader";
import PageFooter from "@/components/public/PageFooter";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";

/**
 * Replaces the prototype's `pageWrapper(title, bodyContent, scripts)` helper
 * from src/server.js, for guest-facing pages only.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  // getThemeSettings() hits the DB on every request; this must never throw,
  // or a transient DB hiccup takes down every page on the site.
  let settings;
  try {
    settings = await getThemeSettings();
  } catch (error) {
    console.error("getThemeSettings failed, falling back to defaults:", error);
    settings = { ...defaultThemeSettings };
  }

  return (
    <div className="page-shell">
      <SiteHeader coupleNames={settings.coupleNames} />
      {children}
      <PageFooter coupleNames={settings.coupleNames} weddingDate={settings.weddingDate} />
    </div>
  );
}
