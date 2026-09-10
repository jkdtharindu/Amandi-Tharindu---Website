/**
 * The pre-login site gate (PRD §15). A signed-out visitor to any guest-facing
 * path is shown the gate instead of the page; `proxy.ts` applies this by
 * rewriting to GATE_ROUTE, so the page's own content is never rendered.
 *
 * Kept free of Next.js imports so the path rules can be unit-tested directly.
 */

export const GATE_ROUTE = '/gate';

// Whole path segments, so `/admin` does not also exempt `/administrator`.
const UNGATED_PREFIXES = [
  '/api', // route handlers do their own auth; the gate itself needs /api/csrf and /api/guest/login
  '/admin', // the admin panel has its own login
  '/_next', // framework assets
  '/fonts', // self-hosted theme fonts, which the gate screen itself uses
  GATE_ROUTE,
];

// Files served from `public/` (favicon.ico, robots.txt, ...). InvitationCodes
// are letters, digits and dashes only, so a dot never appears in a page path.
const FILE_PATH = /\/[^/]+\.[a-z0-9]+$/i;

export function isGatedPath(pathname) {
  const path = String(pathname || '/');
  if (UNGATED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }
  return !FILE_PATH.test(path);
}
