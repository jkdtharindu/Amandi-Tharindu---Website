import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SiteGate from "@/components/public/SiteGate";
import { verifySession } from "@/src/session.js";
import { getThemeSettings } from "@/src/theme/themeRepo.js";
import { themeSettings as defaultThemeSettings } from "@/src/data/themeStore.js";

// getThemeSettings() hits the DB on every request; this must never throw, or
// a transient DB hiccup takes down the one page every guest sees first.
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
  return { title: settings.coupleNames };
}

/**
 * The pre-login site gate (PRD §15). `proxy.ts` rewrites every guest-facing
 * path here for signed-out visitors, so this deliberately lives outside
 * `app/(public)/` — no header, footer, nav or countdown. It renders only what
 * the gate shows: the couple's names, the code field, and settings for the
 * reveal card. Nothing about guests, venues or events reaches the browser.
 */
export default async function GatePage() {
  const cookieStore = await cookies();
  if (verifySession(cookieStore.get("guest_session")?.value)) {
    // Only reachable by visiting /gate directly while signed in.
    redirect("/");
  }

  const settings = await loadThemeSettings();

  return (
    <SiteGate
      coupleNames={settings.coupleNames}
      invitation={{
        templateUrl: settings.invitationTemplateUrl,
        nameTop: settings.invitationNameTop,
        nameLeft: settings.invitationNameLeft,
        nameFontSize: settings.invitationNameFontSize,
        nameColor: settings.invitationNameColor,
      }}
    />
  );
}
