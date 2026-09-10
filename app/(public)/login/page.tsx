import { redirect } from 'next/navigation';

/**
 * The login form was replaced by the site gate (PRD §15, 2026-09-10). Kept as
 * a route so old links and bookmarks still work: signed-out visitors never get
 * here (proxy.ts shows them the gate), signed-in guests go to their invitation.
 */
export default function LoginPage() {
  redirect('/invitation');
}
