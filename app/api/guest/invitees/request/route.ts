import { NextRequest, NextResponse } from 'next/server';
import { findGuestById } from '@/src/guest-auth/guestRepo.js';
import { authorizeRsvp } from '@/src/guest-auth/authorizeRsvp.js';
import { requestNewInvitee } from '@/src/invitees/inviteesRepo.js';
import { validateRequestedInviteeName } from '@/src/invitees/validateInvitees.js';
import { verifySession } from '@/src/session.js';
import { verifyCsrfToken } from '@/src/csrf.js';

/**
 * A guest asks to add someone not on their original invitation. Creates a
 * pending_approval invitee row -- it doesn't count toward RSVP or seating
 * until an admin approves it (see /api/admin/invitee-requests).
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
    const { code, name } = body || {};

    const sessionGuestId = verifySession(request.cookies.get('guest_session')?.value);
    const sessionGuest = sessionGuestId ? await findGuestById(sessionGuestId) : null;
    const auth = authorizeRsvp(sessionGuest, code);
    if (!auth.allowed) {
      return NextResponse.json({ success: false, reason: auth.reason }, { status: auth.status });
    }

    const validation = validateRequestedInviteeName(name);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, reason: 'invalid_name', message: validation.error },
        { status: 400 }
      );
    }

    const invitee = await requestNewInvitee(auth.guest.id, validation.name);
    return NextResponse.json({ success: true, invitee }, { status: 201 });
  } catch (error) {
    console.error('Invitee request error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'An error occurred while sending your request.' },
      { status: 500 }
    );
  }
}
