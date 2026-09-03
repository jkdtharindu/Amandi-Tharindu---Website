import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Celebration — Amandi & Tharindu",
};

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

export default function CelebrationPage() {
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
    </>
  );
}
