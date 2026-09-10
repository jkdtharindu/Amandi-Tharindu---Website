import { NextRequest, NextResponse } from 'next/server';
import {
  findGuestById,
  updateGuestRsvpStatus,
  upsertRsvpResponse,
} from '@/src/guest-auth/guestRepo.js';
import { authorizeRsvp } from '@/src/guest-auth/authorizeRsvp.js';
import { verifySession } from '@/src/session.js';
import { verifyCsrfToken } from '@/src/csrf.js';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify CSRF token
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
    const { code, attending, participantNames } = body || {};

    if (typeof attending !== 'boolean') {
      return NextResponse.json(
        { success: false, reason: 'missing_rsvp_data' },
        { status: 400 }
      );
    }

    // The guest comes from the signed session, not the body — see
    // authorizeRsvp() for what trusting the body's code used to allow.
    const sessionGuestId = verifySession(request.cookies.get('guest_session')?.value);
    const sessionGuest = sessionGuestId ? await findGuestById(sessionGuestId) : null;
    const auth = authorizeRsvp(sessionGuest, code);
    if (!auth.allowed) {
      return NextResponse.json(
        { success: false, reason: auth.reason },
        { status: auth.status }
      );
    }
    const guest = auth.guest;

    // Both calls together: if one fails, the guest's RSVP is inconsistent.
    // Currently they're separate DB calls (not in a transaction). For now, catch
    // failures from both and treat the RSVP response as the source of truth, so at
    // least that part never silently fails.
    const result = await upsertRsvpResponse(
      guest.id,
      attending,
      attending ? participantNames || [] : []
    );
    try {
      await updateGuestRsvpStatus(guest.id, attending ? 'accepted' : 'declined');
    } catch (statusError) {
      console.error('RSVP status update failed after response was saved:', statusError);
      // Response is saved, status update failed. Log it but don't fail the request,
      // since the guest's attendance/participants are already recorded.
    }

    return NextResponse.json({ success: true, rsvp: result });
  } catch (error) {
    console.error('RSVP error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'An error occurred while saving RSVP.' },
      { status: 500 }
    );
  }
}
