import type { Metadata } from "next";
import Link from "next/link";
import Countdown from "@/components/public/Countdown";

export const metadata: Metadata = {
  title: "Amandi & Tharindu — Home",
};

/** Ports the prototype's `GET /home` route from src/server.js. */
export default function HomePage() {
  return (
    <>
      <section className="hero-panel">
        <span className="hero-flag">Save the date — 14 December 2026</span>
        <h1>
          Join us for a celebration of love, family, and new beginnings.
        </h1>
        <p>
          Welcome to the wedding website for Amandi &amp; Tharindu. Discover our
          story, event details, gallery, wishes, and access your personalized
          invitation.
        </p>
        <div className="button-group">
          <Link className="button button-primary" href="/invitation">
            Find Your Invitation
          </Link>
          <Link className="button button-secondary" href="/our-story">
            Our Story
          </Link>
        </div>
        <Countdown />
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
    </>
  );
}
