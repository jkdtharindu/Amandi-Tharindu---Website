import Link from "next/link";

/**
 * Ports the prototype's `siteNav` string plus the surrounding `.site-header`
 * markup from src/server.js.
 *
 * Route names follow the PRD (§8) rather than the prototype's paths:
 *   /home  -> /            /story  -> /our-story
 *   /celebration -> /the-celebration
 *   /login -> /invitation
 */
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/our-story", label: "Our Story" },
  { href: "/the-celebration", label: "Celebration" },
  { href: "/gallery", label: "Gallery" },
  { href: "/wishes", label: "Wishes" },
  { href: "/login", label: "Invitation" },
];

const DEFAULT_COUPLE_NAMES = "Amandi & Tharindu";

export default function SiteHeader({
  coupleNames = DEFAULT_COUPLE_NAMES,
}: {
  coupleNames?: string;
}) {
  return (
    <header className="site-header">
      <div className="site-brand">{coupleNames}</div>
      <nav className="site-nav">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
