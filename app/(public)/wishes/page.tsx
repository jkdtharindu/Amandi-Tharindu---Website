import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wishes — Amandi & Tharindu",
};

/**
 * Ports the prototype's `GET /wishes` route from src/server.js.
 * These Wishes are hardcoded, matching the prototype — there is no `wishes`
 * table yet. Guest-submitted Wishes with Admin approval are deferred
 * (PRD P1-05).
 */
const WISHES = [
  {
    from: "Priya",
    message: "Wishing you both a lifetime of love and laughter.",
  },
  {
    from: "Rohan",
    message: "May your wedding day be the start of a joyful journey together.",
  },
  {
    from: "Anjali",
    message: "So happy for you both — congratulations and best wishes.",
  },
];

export default function WishesPage() {
  return (
    <>
      <section className="hero-panel">
        <span className="hero-flag">Wishes</span>
        <h1>Messages of love and blessings for our wedding.</h1>
        <p>
          Read heartfelt wishes from family and friends as we prepare to
          celebrate together.
        </p>
      </section>
      <section className="grid-panel">
        {WISHES.map((wish) => (
          <div className="wish-card" key={wish.from}>
            <h3>{wish.from}</h3>
            <p>{wish.message}</p>
          </div>
        ))}
      </section>
    </>
  );
}
