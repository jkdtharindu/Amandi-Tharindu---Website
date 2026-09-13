import type { CSSProperties } from "react";
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

/**
 * Milestones for the inlined Our Story section below. Moved here from the
 * old standalone `/our-story` page (Phase 6: single-page homepage redesign)
 * — static, matching the prototype. Making them admin-managed via a
 * `story_milestones` table is deferred (PRD P1-02), same as before the move.
 */
const STORY_MILESTONES = [
  {
    title: "2022 — First meeting",
    body: "They met through mutual friends at a cozy café, and the rest was fate.",
  },
  {
    title: "2024 — First trip together",
    body: "A weekend escape to the coast brought them even closer and proved they were ready for the next chapter.",
  },
  {
    title: "2025 — Engagement",
    body: "A romantic proposal under the stars sealed their promise to spend forever together.",
  },
];

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

  // Page key stays "our-story" (unchanged from the old standalone route) so
  // any sections an admin already configured for it keep showing up here.
  let ourStorySections;
  try {
    ourStorySections = await listSections("our-story");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    ourStorySections = [];
  }

  const heroClassName = settings.heroImageUrl
    ? "hero-panel hero-panel--photo"
    : "hero-panel";
  const heroStyle = settings.heroImageUrl
    ? ({ "--hero-image-url": `url(${JSON.stringify(settings.heroImageUrl)})` } as CSSProperties)
    : undefined;

  return (
    <>
      <section className={heroClassName} style={heroStyle}>
        <svg className="hero-sprig" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <path d="M50 95 C48 70 46 45 44 15" fill="none" stroke="var(--color-accent-deep)" strokeWidth="1.2" />
          <path d="M44 30 C34 26 26 30 20 40 C30 42 38 40 44 30Z" fill="none" stroke="var(--color-accent-deep)" strokeWidth="1.1" />
          <path d="M46 45 C58 40 66 44 71 54 C60 57 51 54 46 45Z" fill="none" stroke="var(--color-accent-deep)" strokeWidth="1.1" />
          <path d="M44 58 C33 55 25 60 21 70 C32 71 40 68 44 58Z" fill="none" stroke="var(--color-accent-deep)" strokeWidth="1.1" />
          <circle cx="50" cy="14" r="3" fill="none" stroke="var(--color-accent-deep)" strokeWidth="1.1" />
        </svg>
        <svg className="hero-sprig-mirror" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <path d="M50 95 C48 70 46 45 44 15" fill="none" stroke="var(--color-accent-deep)" strokeWidth="1.2" />
          <path d="M44 30 C34 26 26 30 20 40 C30 42 38 40 44 30Z" fill="none" stroke="var(--color-accent-deep)" strokeWidth="1.1" />
          <path d="M46 45 C58 40 66 44 71 54 C60 57 51 54 46 45Z" fill="none" stroke="var(--color-accent-deep)" strokeWidth="1.1" />
        </svg>
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
          <Link className="button button-primary" href="/invitation">
            View Your Invitation
          </Link>
          <Link className="button button-secondary" href="#our-story">
            Our Story
          </Link>
        </div>
        <Countdown targetDate={`${settings.weddingDate}T${settings.weddingTime}:00+05:30`} />
      </section>
      <section id="our-story" className="hero-panel hero-panel--light">
        <span className="hero-flag">Our story</span>
        <h2>How our love story began and grew into a wedding celebration.</h2>
        <p>
          From a serendipitous first meeting to a joyful proposal under the
          stars, our story is full of memorable moments we want to share with
          you.
        </p>
      </section>
      <section className="grid-panel">
        {STORY_MILESTONES.map((milestone) => (
          <div className="story-card" key={milestone.title}>
            <h3>{milestone.title}</h3>
            <p>{milestone.body}</p>
          </div>
        ))}
      </section>
      <CustomSections sections={ourStorySections} />
      <section className="section-grid">
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
