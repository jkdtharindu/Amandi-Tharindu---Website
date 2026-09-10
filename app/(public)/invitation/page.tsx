import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { findGuestById } from '@/src/guest-auth/guestRepo.js';
import { verifySession } from '@/src/session.js';

/** The nav's "Invitation" link: sends a signed-in guest to their own card. */
export default async function MyInvitationPage() {
  const cookieStore = await cookies();
  const guestId = verifySession(cookieStore.get('guest_session')?.value);
  const guest = guestId ? await findGuestById(guestId) : null;

  // Signed-out visitors are shown the gate by proxy.ts before reaching here;
  // this covers a validly signed cookie whose guest has since been deleted.
  if (!guest) redirect('/');

  redirect(`/invitation/${encodeURIComponent(guest.code)}`);
}
