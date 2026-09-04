import type { Metadata } from "next";
import Link from "next/link";
import Countdown from "@/components/public/Countdown";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";
import { formatWeddingDate } from "@/src/theme/formatWeddingDate.js";
import { listSections } from "@/src/sections/sectionsRepo.js";
import CustomSections from "@/components/public/CustomSections";

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
  return { title: `${settings.coupleNames} — Home` };
}

/** Ports the prototype's `GET /home` route from src/server.js. */
export default async function HomePage() {
  const settings = await loadThemeSettings();

  // listSections() must never throw, or a transient DB hiccup takes down
  // the page — same reasoning as loadThemeSettings above.
  let sections;
  try {
    sections = await listSections("home");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    sections = [];
  }

  return (
    <>
      <section className="hero-panel">
        <span className="hero-flag">
          Save the date — {formatWeddingDate(settings.weddingDate)}
        </span>
        <h1>
          Join us for a celebration of love, family, and new beginnings.
        </h1>
        <p>
          Welcome to the wedding website for {settings.coupleNames}. Discover our
          story, event details, gallery, wishes, and access your personalized
          invitation.
        </p>
        <div className="button-group">
          <Link className="button button-primary" href="/login">
            Find Your Invitation
          </Link>
          <Link className="button button-secondary" href="/our-story">
            Our Story
          </Link>
        </div>
        <Countdown targetDate={`${settings.weddingDate}T15:00:00`} />
      </section>
      <section className="section-grid">
        <div className="feature-card">
          <h2>Our Love Story</h2>
          <p>
            Explore how two hearts met, grew together, and decided to celebrate
            forever with family.
          </p>
        </div>
        <div className="feature-card">
          <h2>The Celebration</h2>
          <p>
            See the ceremony and reception details, venues, and schedule for the
            wedding day.
          </p>
        </div>
        <div className="feature-card">
          <h2>Gallery</h2>
          <p>
            Enjoy a curated collection of photos from the couple&rsquo;s journey
            and engagement moments.
          </p>
        </div>
        <div className="feature-card">
          <h2>Wishes Wall</h2>
          <p>
            Read warm wishes from family and friends, and leave your own message
            to the couple.
          </p>
        </div>
      </section>
      <CustomSections sections={sections} />
    </>
  );
}
