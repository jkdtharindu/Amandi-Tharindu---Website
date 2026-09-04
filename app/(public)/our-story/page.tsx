import type { Metadata } from "next";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";

export async function generateMetadata(): Promise<Metadata> {
  let settings;
  try {
    settings = await getThemeSettings();
  } catch (error) {
    console.error("getThemeSettings failed, falling back to defaults:", error);
    settings = { ...defaultThemeSettings };
  }
  return { title: `Our Story — ${settings.coupleNames}` };
}

/**
 * Ports the prototype's `GET /story` route from src/server.js.
 * Milestones are static here, matching the prototype. Making them
 * admin-managed via the `story_milestones` table is deferred (PRD P1-02).
 */
const MILESTONES = [
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

export default function OurStoryPage() {
  return (
    <>
      <section className="hero-panel">
        <span className="hero-flag">Our story</span>
        <h1>How our love story began and grew into a wedding celebration.</h1>
        <p>
          From a serendipitous first meeting to a joyful proposal under the
          stars, our story is full of memorable moments we want to share with
          you.
        </p>
      </section>
      <section className="grid-panel">
        {MILESTONES.map((milestone) => (
          <div className="story-card" key={milestone.title}>
            <h3>{milestone.title}</h3>
            <p>{milestone.body}</p>
          </div>
        ))}
      </section>
    </>
  );
}
