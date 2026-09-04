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
  return { title: `Wishes — ${settings.coupleNames}` };
}

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

export default async function WishesPage() {
  // listSections() must never throw, or a transient DB hiccup takes down
  // the page — same reasoning as loadThemeSettings elsewhere.
  let sections;
  try {
    sections = await listSections("wishes");
  } catch (error) {
    console.error("listSections failed, falling back to none:", error);
    sections = [];
  }

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
      <CustomSections sections={sections} />
    </>
  );
}
