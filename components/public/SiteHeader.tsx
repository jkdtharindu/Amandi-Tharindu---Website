"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSiteText } from "@/components/SiteTextProvider";

/**
 * Phase 6 (single-page homepage redesign): nav links now point at homepage
 * section anchors instead of the old standalone routes those sections were
 * folded into (`/our-story` etc. still work as redirects — next.config.ts —
 * for anyone with an old link, but the nav itself jumps straight to the
 * anchor). "Invitation" stays a real route: it's the guest's own RSVP card,
 * not a homepage section.
 *
 * Only ever rendered for a signed-in guest — signed-out visitors see the site
 * gate (PRD §15) — so "Invitation" goes straight to the guest's own card.
 */
const NAV_LINKS: { href: string; label: string; sectionId?: string }[] = [
  { href: "/#home", label: "menu.home", sectionId: "home" },
  { href: "/#our-story", label: "menu.ourStory", sectionId: "our-story" },
  { href: "/#family-details", label: "menu.familyDetails", sectionId: "family-details" },
  { href: "/#event-details", label: "menu.eventDetails", sectionId: "event-details" },
  { href: "/#gallery", label: "menu.gallery", sectionId: "gallery" },
  { href: "/#wishes", label: "menu.wishes", sectionId: "wishes" },
  { href: "/invitation", label: "menu.invitation" },
];

const DEFAULT_COUPLE_NAMES = "Amandi & Tharindu";

export default function SiteHeader({
  coupleNames = DEFAULT_COUPLE_NAMES,
  hiddenSections = [],
}: {
  coupleNames?: string;
  /** Section ids the admin has hidden; their nav links are left out. */
  hiddenSections?: string[];
}) {
  const hiddenKey = hiddenSections.join(",");
  const navLinks = useMemo(
    () => NAV_LINKS.filter((link) => !link.sectionId || !hiddenKey.split(",").includes(link.sectionId)),
    [hiddenKey],
  );
  const pathname = usePathname();
  const t = useSiteText();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Section anchors only exist on the homepage. A guest reading their own
  // /invitation card, or on /login, has none of these ids in the DOM.
  useEffect(() => {
    if (pathname !== "/") {
      // Deferred rather than called synchronously in the effect body, to
      // avoid react-hooks/set-state-in-effect (cascading-render) — same
      // pattern as Countdown.tsx's initial tick.
      const clear = setTimeout(() => setActiveSection(null), 0);
      return () => clearTimeout(clear);
    }

    const sections = navLinks.map((link) => link.sectionId)
      .filter((id): id is string => Boolean(id))
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    // A thin horizontal band a bit above center: whichever section is
    // crossing it as the guest scrolls counts as "currently viewing". Some
    // sections (Family Details, Gallery) only render when there's content,
    // so this only ever observes whatever actually exists on the page.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname, navLinks]);

  // A stale open mobile menu shouldn't survive a navigation (e.g. the browser
  // back button). Deferred for the same react-hooks/set-state-in-effect
  // reason as above.
  useEffect(() => {
    const clear = setTimeout(() => setIsMenuOpen(false), 0);
    return () => clearTimeout(clear);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  return (
    <header className="site-header">
      <a href="#home" className="skip-to-content">
        Skip to content
      </a>
      <div className="site-header-row">
        <div className="site-brand">{coupleNames}</div>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="site-nav"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span className="sr-only">{isMenuOpen ? "Close menu" : "Open menu"}</span>
          <span aria-hidden="true">{isMenuOpen ? "✕" : "☰"}</span>
        </button>
      </div>
      <nav id="site-nav" className={`site-nav${isMenuOpen ? " site-nav--open" : ""}`}>
        {navLinks.map((link) => {
          const isActive = link.sectionId
            ? activeSection === link.sectionId
            : // "Invitation" resolves to /invitation/[code] once signed in.
              pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? "active" : undefined}
              onClick={() => setIsMenuOpen(false)}
            >
              {t(link.label)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
