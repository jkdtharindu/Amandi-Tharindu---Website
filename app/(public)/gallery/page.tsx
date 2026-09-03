import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gallery — Amandi & Tharindu",
};

/**
 * Ports the prototype's `GET /gallery` route from src/server.js.
 * These are the prototype's placeholder tiles, kept for parity. Real photos
 * from the `gallery_photos` table plus Supabase Storage are deferred
 * (PRD P1-04).
 */
const PLACEHOLDER_TILES = ["Photo 1", "Photo 2", "Photo 3", "Photo 4"];

export default function GalleryPage() {
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
    </>
  );
}
