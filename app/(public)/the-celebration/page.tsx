import type { Metadata } from "next";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";
import { listSections } from "@/src/sections/sectionsRepo.js";
import CustomSections from "@/components/public/CustomSections";
import { listEvents } from "@/src/celebration-events/celebrationEventsRepo.js";
import { formatWeddingDate } from "@/src/theme/formatWeddingDate.js";
import type { CelebrationEvent } from "@/components/admin/EventManager";

export async function generateMetadata(): Promise<Metadata> {
  let settings;
  try {
    settings = await getThemeSettings();
  } catch (error) {
    console.error("getThemeSettings failed, falling back to defaults:", error);
    settings = { ...defaultThemeSettings };
  }
  return { title: `The Celebration — ${settings.coupleNames}` };
}

export default async function CelebrationPage() {
  // listSections()/listEvents() must never throw, or a transient DB hiccup
  // takes down the page — same reasoning as loadThemeSettings elsewhere.
  // Section page key is "celebration" (VALID_PAGES), matching this route's
  // legacy path (/celebration), not the Next.js folder name (the-celebration).
  let sections;
  try {
    sections = await listSections("celebration");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    sections = [];
  }

  let events: CelebrationEvent[];
  try {
    events = await listEvents();
  } catch (error) {
    console.error("listEvents failed, falling back to none:", error);
    events = [];
  }

  return (
    <>
      <section className="hero-panel">
        <span className="hero-flag">Wedding events</span>
        <h1>Celebrate with us at the ceremony and reception.</h1>
        <p>
          We are excited to welcome our family and friends for a day filled with
          love, joy, and unforgettable moments.
        </p>
      </section>
      <section className="section-grid">
        {events.map((event) => (
          <div className="event-card" key={event.id}>
            <h2>{event.name}</h2>
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
      <CustomSections sections={sections} />
    </>
  );
}
