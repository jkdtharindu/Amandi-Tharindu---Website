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
  return { title: `The Celebration — ${settings.coupleNames}` };
}

/**
 * Ports the prototype's `GET /celebration` route from src/server.js.
 * Events are static here, matching the prototype. Making them admin-managed
 * via the `events` table is deferred (PRD P1-03 / P1-09).
 */
const CELEBRATION_EVENTS = [
  {
    name: "Ceremony",
    date: "Monday, 14 December 2026",
    time: "3:00 PM",
    venue: "Sunrise Garden Hall",
  },
  {
    name: "Reception",
    date: "Monday, 14 December 2026",
    time: "6:00 PM",
    venue: "Moonlight Banquet Hall",
  },
];

export default async function CelebrationPage() {
  // listSections() must never throw, or a transient DB hiccup takes down
  // the page — same reasoning as loadThemeSettings elsewhere. Section page
  // key is "celebration" (VALID_PAGES), matching this route's legacy path
  // (/celebration), not the Next.js folder name (the-celebration).
  let sections;
  try {
    sections = await listSections("celebration");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    sections = [];
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
        {CELEBRATION_EVENTS.map((event) => (
          <div className="event-card" key={event.name}>
            <h2>{event.name}</h2>
            <p>
              <strong>Date:</strong> {event.date}
            </p>
            <p>
              <strong>Time:</strong> {event.time}
            </p>
            <p>
              <strong>Venue:</strong> {event.venue}
            </p>
            <p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.venue)}`}
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
