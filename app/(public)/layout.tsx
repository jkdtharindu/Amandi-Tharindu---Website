import type { ReactNode } from "react";
import SiteHeader from "@/components/public/SiteHeader";
import PageFooter from "@/components/public/PageFooter";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { SiteTextProvider } from "@/components/SiteTextProvider";
import { getSiteTextSafe } from "@/src/site-text/siteTextRepo.js";
import { createT } from "@/src/site-text/siteTextRegistry.js";
import { getHomeSectionVisibilitySafe, HOME_SECTION_KEYS } from "@/src/home-sections/homeSectionsRepo.js";
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

  const visibility = await getHomeSectionVisibilitySafe();
  const texts = await getSiteTextSafe();
  const hiddenSections = HOME_SECTION_KEYS.filter((key) => !visibility[key]);

  return (
    <div className="page-shell">
      <SiteTextProvider texts={texts}>
        <SiteHeader coupleNames={settings.coupleNames} hiddenSections={hiddenSections} />
        {children}
        <PageFooter coupleNames={settings.coupleNames} weddingDate={settings.weddingDate} t={createT(texts)} />
      </SiteTextProvider>
    </div>
  );
}
