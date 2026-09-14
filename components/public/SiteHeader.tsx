"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/guest/LogoutButton";

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
  { href: "/#home", label: "Home", sectionId: "home" },
  { href: "/#our-story", label: "Our Story", sectionId: "our-story" },
  { href: "/#family-details", label: "Family Details", sectionId: "family-details" },
  { href: "/#event-details", label: "Event Details", sectionId: "event-details" },
  { href: "/#gallery", label: "Gallery", sectionId: "gallery" },
  { href: "/#wishes", label: "Wishes", sectionId: "wishes" },
  { href: "/invitation", label: "Invitation" },
];

const DEFAULT_COUPLE_NAMES = "Amandi & Tharindu";

export default function SiteHeader({
  coupleNames = DEFAULT_COUPLE_NAMES,
}: {
  coupleNames?: string;
}) {
  const pathname = usePathname();
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

    const sections = NAV_LINKS.map((link) => link.sectionId)
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
  }, [pathname]);

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
        {NAV_LINKS.map((link) => {
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
              {link.label}
            </Link>
          );
        })}
        <LogoutButton />
      </nav>
    </header>
  );
}
