import { NextRequest, NextResponse } from 'next/server';
import {
  findGuestByCode,
  updateGuestRsvpStatus,
  upsertRsvpResponse,
} from '@/src/guest-auth/guestRepo.js';
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

    if (!code || typeof attending !== 'boolean') {
      return NextResponse.json(
        { success: false, reason: 'missing_rsvp_data' },
        { status: 400 }
      );
    }

    const guest = await findGuestByCode(code);
    if (!guest) {
      return NextResponse.json(
        { success: false, reason: 'guest_not_found' },
        { status: 404 }
      );
    }

    const result = await upsertRsvpResponse(
      guest.id,
      attending,
      attending ? participantNames || [] : []
    );
    await updateGuestRsvpStatus(guest.id, attending ? 'accepted' : 'declined');

    return NextResponse.json({ success: true, rsvp: result });
  } catch (error) {
    console.error('RSVP error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'An error occurred while saving RSVP.' },
      { status: 500 }
    );
  }
}
