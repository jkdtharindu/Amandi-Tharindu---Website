import { NextRequest, NextResponse } from 'next/server';
import { findGuestById } from '@/src/guest-auth/guestRepo.js';
import { verifySession } from '@/src/session.js';

// Read per request: the answer depends on who is signed in.
export const dynamic = 'force-dynamic';

/**
 * The "Invitation" button and nav link: sends a signed-in guest to their own card.
 *
 * A route handler, not a page: a page here sat behind invitation/loading.tsx, which
 * makes the server answer 200 with a spinner first and only then redirect from inside
 * the stream. On the live site that redirect often never fired, so the button seemed
 * to do nothing. A route handler answers with a real HTTP redirect before anything is
 * streamed, which works for both a normal click and a full page load.
 *
 * Signed-out visitors are shown the gate by proxy.ts before reaching here. A validly
 * signed cookie whose guest has since been deleted gets past proxy.ts (it only checks the
 * signature), so it is cleared here: otherwise the guest keeps seeing the home page, the
 * button keeps bouncing back to it, and the code box never comes back.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guestId = verifySession(request.cookies.get('guest_session')?.value);
  const guest = guestId ? await findGuestById(guestId) : null;

  const target = guest ? `/invitation/${encodeURIComponent(guest.code)}` : '/';
  const response = NextResponse.redirect(new URL(target, request.url));
  response.headers.set('Cache-Control', 'no-store');
  if (!guest) {
    response.cookies.set('guest_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
  }
  return response;
}
