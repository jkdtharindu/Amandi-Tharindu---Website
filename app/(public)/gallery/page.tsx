import type { Metadata } from "next";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";
import { listSections } from "@/src/sections/sectionsRepo.js";
import CustomSections from "@/components/public/CustomSections";

export async function generateMetadata(): Promise<Metadata> {
  let settings;
  try {
    settings = await getThemeSettings();
  } catch (error) {
    console.error("getThemeSettings failed, falling back to defaults:", error);
    settings = { ...defaultThemeSettings };
  }
  return { title: `Gallery — ${settings.coupleNames}` };
}

/**
 * Ports the prototype's `GET /gallery` route from src/server.js.
 * These are the prototype's placeholder tiles, kept for parity. Real photos
 * from the `gallery_photos` table plus Supabase Storage are deferred
 * (PRD P1-04).
 */
const PLACEHOLDER_TILES = ["Photo 1", "Photo 2", "Photo 3", "Photo 4"];

export default async function GalleryPage() {
  // listSections() must never throw, or a transient DB hiccup takes down
  // the page — same reasoning as loadThemeSettings elsewhere.
  let sections;
  try {
    sections = await listSections("gallery");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    sections = [];
  }

  return (
    <>
      <section className="hero-panel">
        <span className="hero-flag">Gallery</span>
        <h1>Photos from our journey together.</h1>
        <p>
          Enjoy a collection of moments from the couple&rsquo;s story,
          engagement, and memories shared with loved ones.
        </p>
      </section>
      <section className="gallery-grid">
        {PLACEHOLDER_TILES.map((tile) => (
          <div className="gallery-card" key={tile}>
            {tile}
          </div>
        ))}
      </section>
      <CustomSections sections={sections} />
    </>
  );
}
