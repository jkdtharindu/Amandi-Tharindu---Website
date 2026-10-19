import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Countdown from "@/components/public/Countdown";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";
import { formatWeddingDate } from "@/src/theme/formatWeddingDate.js";
import { listSections } from "@/src/sections/sectionsRepo.js";
import CustomSections from "@/components/public/CustomSections";
import FaqAccordion from "@/components/public/FaqAccordion";
import { getSiteTextSafe } from "@/src/site-text/siteTextRepo.js";
import { createT } from "@/src/site-text/siteTextRegistry.js";
import { getHomeSectionVisibilitySafe } from "@/src/home-sections/homeSectionsRepo.js";
import { listEvents } from "@/src/celebration-events/celebrationEventsRepo.js";
import { listGalleryPhotos } from "@/src/gallery/galleryPhotosRepo.js";
import { heroOverlayValue } from "@/src/theme/heroOverlay.js";
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

  const visibility = await getHomeSectionVisibilitySafe();
  const t = createT(await getSiteTextSafe());
  const storyMilestones = [1, 2, 3].map((n) => ({
    title: t(`story.m${n}.title`),
    body: t(`story.m${n}.body`),
  }));
  const hasFaq = visibility.faq && faqSections.some((section) => section.isVisible && section.title);
  const hasGalleryPhotos = visibility.gallery && galleryPhotos.length > 0;
  const hasCoupleProfiles =
    visibility["family-details"] && Boolean(settings.brideName || settings.groomName);

  const heroClassName = settings.heroImageUrl
    ? "hero-panel hero-panel--photo"
    : "hero-panel";
  const heroStyle = settings.heroImageUrl
    ? ({
        "--hero-image-url": `url(${JSON.stringify(settings.heroImageUrl)})`,
        "--hero-overlay": heroOverlayValue(settings.heroDominantColor, settings.heroOverlayEnabled),
      } as CSSProperties)
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
          {t("hero.flag", { weddingDate: formatWeddingDate(settings.weddingDate) })}
        </span>
        <h1>{t("hero.heading")}</h1>
        <p>{t("hero.intro", { coupleNames: settings.coupleNames })}</p>
        <div className="button-group">
          <Link className="button button-primary" href="/invitation">
            {t("hero.buttonInvitation")}
          </Link>
          <Link className="button button-secondary" href="#our-story">
            {t("hero.buttonStory")}
          </Link>
        </div>
        <Countdown targetDate={`${settings.weddingDate}T${settings.weddingTime}:00+05:30`} />
      </section>
      {visibility["our-story"] && (
        <>
      <section id="our-story" className="hero-panel hero-panel--light hero-panel--wide">
        <span className="hero-flag">{t("story.flag")}</span>
        <h2>{t("story.heading")}</h2>
        <p>{t("story.intro")}</p>
        <div className="panel-cards grid-panel">
          {storyMilestones.map((milestone) => (
            <div className="story-card" key={milestone.title}>
              <h3>{milestone.title}</h3>
              <p>{milestone.body}</p>
            </div>
          ))}
        </div>
      </section>
      <CustomSections sections={ourStorySections} />
        </>
      )}
      {hasCoupleProfiles && (
        <>
          <section id="family-details" className="hero-panel hero-panel--light hero-panel--wide">
            <span className="hero-flag">{t("couple.flag")}</span>
            <h2>{t("couple.heading")}</h2>
          <div className="panel-cards section-grid couple-grid">
            {settings.brideName && (
              <div className="couple-card">
                {settings.bridePhotoUrl && (
                  <Image
                    src={settings.bridePhotoUrl}
                    alt={settings.brideName}
                    className="couple-photo"
                    width={300}
                    height={375}
                    sizes="150px"
                  />
                )}
                <h3>{settings.brideName}</h3>
                {settings.brideBio && <p>{settings.brideBio}</p>}
              </div>
            )}
            {settings.groomName && (
              <div className="couple-card">
                {settings.groomPhotoUrl && (
                  <Image
                    src={settings.groomPhotoUrl}
                    alt={settings.groomName}
                    className="couple-photo"
                    width={300}
                    height={375}
                    sizes="150px"
                  />
                )}
                <h3>{settings.groomName}</h3>
                {settings.groomBio && <p>{settings.groomBio}</p>}
              </div>
            )}
          </div>
          </section>
        </>
      )}
      {visibility["event-details"] && (
        <>
      <section id="event-details" className="hero-panel hero-panel--light hero-panel--wide">
        <span className="hero-flag">{t("events.flag")}</span>
        <h2>{t("events.heading")}</h2>
        <p>{t("events.intro")}</p>
        <div className="panel-cards section-grid">
        {events.map((event) => (
          <div className="event-card" key={event.id}>
            {event.imageUrl && (
              <Image
                src={event.imageUrl}
                alt={event.venueName}
                className="event-image"
                width={800}
                height={320}
                sizes="100vw"
              />
            )}
            <h3>{event.name}</h3>
            <p>
              <strong>{t("events.labelDate")}:</strong> {formatWeddingDate(event.eventDate)}
            </p>
            <p>
              <strong>{t("events.labelTime")}:</strong> {event.eventTime}
            </p>
            <p>
              <strong>{t("events.labelVenue")}:</strong> {event.venueName}
            </p>
            {event.venueAddress && (
              <p>
                <strong>{t("events.labelAddress")}:</strong> {event.venueAddress}
              </p>
            )}
            {event.parkingNote && (
              <p>
                <strong>{t("events.labelParking")}:</strong> {event.parkingNote}
              </p>
            )}
            {event.dressCode && (
              <p>
                <strong>{t("events.labelDressCode")}:</strong> {event.dressCode}
              </p>
            )}
            <p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.venueAddress || event.venueName)}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("events.mapLink")}
              </a>
            </p>
          </div>
        ))}
        </div>
      </section>
      <CustomSections sections={celebrationSections} />
        </>
      )}
      {hasGalleryPhotos && (
        <>
          <section id="gallery" className="hero-panel hero-panel--light hero-panel--wide">
            <span className="hero-flag">{t("gallery.flag")}</span>
            <h2>{t("gallery.heading")}</h2>
            <p>{t("gallery.intro")}</p>
          <div className="panel-cards gallery-grid">
            {galleryPhotos.map((photo) => (
              <div key={photo.id} className="gallery-card">
                <Image
                  src={photo.photoUrl}
                  alt={photo.caption || "Gallery photo"}
                  width={600}
                  height={220}
                  sizes="100vw"
                />
                {photo.caption && <p className="gallery-caption">{photo.caption}</p>}
              </div>
            ))}
          </div>
          </section>
        </>
      )}
      <CustomSections sections={gallerySections} />
      {hasFaq && (
        <section id="faq" className="hero-panel hero-panel--light">
          <span className="hero-flag">{t("faq.flag")}</span>
          <h2>{t("faq.heading")}</h2>
          <p>{t("faq.intro")}</p>
          <FaqAccordion sections={faqSections} />
        </section>
      )}
      {visibility.wishes && (
        <>
      <section id="wishes" className="hero-panel hero-panel--seal">
        <span className="hero-flag">{t("wishes.flag")}</span>
        <h2>{t("wishes.heading")}</h2>
        <p>{t("wishes.intro")}</p>
        <div className="button-group">
          <Link className="button button-primary" href="/invitation">
            {t("wishes.button")}
          </Link>
        </div>
      </section>
      <CustomSections sections={wishesSections} />
        </>
      )}
      <CustomSections sections={sections} />
    </>
  );
}
