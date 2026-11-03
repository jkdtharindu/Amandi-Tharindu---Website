import { NextRequest, NextResponse } from 'next/server';
import { findGuestById } from '@/src/guest-auth/guestRepo.js';
import { authorizeRsvp } from '@/src/guest-auth/authorizeRsvp.js';
import { listApprovedInvitees, setDeclineRequested } from '@/src/invitees/inviteesRepo.js';
import { isInviteeSeated } from '@/src/table-arrangement/tableArrangementRepo.js';
import { verifySession } from '@/src/session.js';
import { verifyCsrfToken } from '@/src/csrf.js';

/**
 * A guest asks the couple to free the seat of a person who is already confirmed and
 * seated, because that person can no longer come. Nothing changes on the RSVP yet:
 * the request is only remembered. When the admin frees the seat, the person's answer
 * becomes "declined" by itself (see applyDeclineAfterUnseat in src/rsvp/saveRsvp.js).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyCsrfToken(request)) {
      return NextResponse.json(
        { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
        { status: 400 }
      );
    }
    const { code, inviteeId } = body || {};

    const sessionGuestId = verifySession(request.cookies.get('guest_session')?.value);
    const sessionGuest = sessionGuestId ? await findGuestById(sessionGuestId) : null;
    const auth = authorizeRsvp(sessionGuest, code);
    if (!auth.allowed) {
      return NextResponse.json({ success: false, reason: auth.reason }, { status: auth.status });
    }

    // Only this guest's own approved, accepted and seated people can be asked about.
    const person = (await listApprovedInvitees(auth.guest.id)).find(
      (invitee: { id: string }) => invitee.id === inviteeId
    );
    if (!person || person.rsvpStatus !== 'accepted' || !(await isInviteeSeated(person.id))) {
      return NextResponse.json(
        {
          success: false,
          reason: 'not_seated',
          message: 'That person does not have a seat, so you can decline for them directly.',
        },
        { status: 400 }
      );
    }

    await setDeclineRequested(person.id, true);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Decline request error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'Could not send your request. Please try again.' },
      { status: 500 }
    );
  }
}
