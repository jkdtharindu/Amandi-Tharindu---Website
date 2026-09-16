import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Countdown from "@/components/public/Countdown";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";
import { formatWeddingDate } from "@/src/theme/formatWeddingDate.js";
import { listSections } from "@/src/sections/sectionsRepo.js";
import CustomSections from "@/components/public/CustomSections";
import FaqAccordion from "@/components/public/FaqAccordion";
import { listEvents } from "@/src/celebration-events/celebrationEventsRepo.js";
import { listGalleryPhotos } from "@/src/gallery/galleryPhotosRepo.js";
import type { CelebrationEvent } from "@/components/admin/EventManager";
import type { Section } from "@/components/admin/SectionManager";

type GalleryPhoto = {
  id: string;
  photoUrl: string;
  caption: string;
  displayOrder: number;
};

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

  // Page key stays "celebration" (unchanged from the old /the-celebration
  // route, VALID_PAGES) so any sections an admin already configured for it
  // keep showing up here.
  let celebrationSections;
  try {
    celebrationSections = await listSections("celebration");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    celebrationSections = [];
  }

  let events: CelebrationEvent[];
  try {
    events = await listEvents();
  } catch (error) {
    console.error("listEvents failed, falling back to none:", error);
    events = [];
  }

  // Page key stays "gallery" (unchanged from the old standalone route) so any
  // sections an admin already configured for it keep showing up here.
  let gallerySections: Section[];
  try {
    gallerySections = await listSections("gallery");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    gallerySections = [];
  }

  let galleryPhotos: GalleryPhoto[] = [];
  try {
    galleryPhotos = await listGalleryPhotos();
  } catch (error) {
    console.error("listGalleryPhotos failed, falling back to none:", error);
    galleryPhotos = [];
  }

  // Page key "faq" is new (Phase 6) — admin adds questions/answers as plain
  // sections (title = question, content = answer) via the existing Section
  // Manager (P1-11); FaqAccordion renders them as a <details> accordion.
  let faqSections: Section[];
  try {
    faqSections = await listSections("faq");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    faqSections = [];
  }

  // Page key stays "wishes" (unchanged from the old standalone route) so any
  // sections an admin already configured for it keep showing up here.
  let wishesSections: Section[];
  try {
    wishesSections = await listSections("wishes");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    wishesSections = [];
  }

  const hasFaq = faqSections.some((section) => section.isVisible && section.title);
  const hasGalleryPhotos = galleryPhotos.length > 0;
  const hasCoupleProfiles = Boolean(settings.brideName || settings.groomName);

  const heroClassName = settings.heroImageUrl
    ? "hero-panel hero-panel--photo"
    : "hero-panel";
  const heroStyle = settings.heroImageUrl
    ? ({ "--hero-image-url": `url(${JSON.stringify(settings.heroImageUrl)})` } as CSSProperties)
    : undefined;

  return (
    <>
      <section id="home" className={heroClassName} style={heroStyle}>
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
      {hasCoupleProfiles && (
        <>
          <section id="family-details" className="hero-panel hero-panel--light">
            <span className="hero-flag">The couple</span>
            <h2>Meet the bride and groom.</h2>
          </section>
          <section className="section-grid">
            {settings.brideName && (
              <div className="couple-card">
                {settings.bridePhotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote, admin-uploaded URL (Vercel Blob); see ImageUploadField.tsx.
                  <img src={settings.bridePhotoUrl} alt={settings.brideName} className="couple-photo" loading="lazy" />
                )}
                <h3>{settings.brideName}</h3>
                {settings.brideBio && <p>{settings.brideBio}</p>}
              </div>
            )}
            {settings.groomName && (
              <div className="couple-card">
                {settings.groomPhotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote, admin-uploaded URL (Vercel Blob); see ImageUploadField.tsx.
                  <img src={settings.groomPhotoUrl} alt={settings.groomName} className="couple-photo" loading="lazy" />
                )}
                <h3>{settings.groomName}</h3>
                {settings.groomBio && <p>{settings.groomBio}</p>}
              </div>
            )}
          </section>
        </>
      )}
      <section id="event-details" className="hero-panel hero-panel--seal">
        <span className="hero-flag">Wedding events</span>
        <h2>Celebrate with us at the ceremony and reception.</h2>
        <p>
          We are excited to welcome our family and friends for a day filled with
          love, joy, and unforgettable moments.
        </p>
      </section>
      <section className="section-grid">
        {events.map((event) => (
          <div className="event-card" key={event.id}>
            {event.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- remote, admin-uploaded URL (Vercel Blob); see ImageUploadField.tsx.
              <img src={event.imageUrl} alt={event.venueName} className="event-image" loading="lazy" />
            )}
            <h3>{event.name}</h3>
            <p>
              <strong>Date:</strong> {formatWeddingDate(event.eventDate)}
            </p>
            <p>
              <strong>Time:</strong> {event.eventTime}
            </p>
            <p>
              <strong>Venue:</strong> {event.venueName}
            </p>
            <p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.venueAddress || event.venueName)}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Google Maps
              </a>
            </p>
          </div>
        ))}
      </section>
      <CustomSections sections={celebrationSections} />
      {hasGalleryPhotos && (
        <>
          <section id="gallery" className="hero-panel hero-panel--light">
            <span className="hero-flag">Gallery</span>
            <h2>Photos from our journey together.</h2>
            <p>
              Enjoy a curated collection of moments from our story, engagement,
              and memories shared with loved ones.
            </p>
          </section>
          <section className="gallery-grid">
            {galleryPhotos.map((photo) => (
              <div key={photo.id} className="gallery-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote, admin-uploaded URL (Vercel Blob); see ImageUploadField.tsx. */}
                <img src={photo.photoUrl} alt={photo.caption || "Gallery photo"} loading="lazy" />
                {photo.caption && <p className="gallery-caption">{photo.caption}</p>}
              </div>
            ))}
          </section>
        </>
      )}
      <CustomSections sections={gallerySections} />
      {hasFaq && (
        <section id="faq" className="hero-panel hero-panel--light">
          <span className="hero-flag">FAQ</span>
          <h2>Frequently asked questions.</h2>
          <p>
            Answers to the questions we hear most often — reach out if yours
            isn&rsquo;t here.
          </p>
          <FaqAccordion sections={faqSections} />
        </section>
      )}
      <section id="wishes" className="hero-panel hero-panel--seal">
        <span className="hero-flag">Wishes</span>
        <h2>Thank you for being part of our story.</h2>
        <p>
          We can&rsquo;t wait to celebrate with you. View your personal
          invitation to RSVP and see your event details.
        </p>
        <div className="button-group">
          <Link className="button button-primary" href="/invitation">
            View Your Invitation
          </Link>
        </div>
      </section>
      <CustomSections sections={wishesSections} />
      <CustomSections sections={sections} />
    </>
  );
}
