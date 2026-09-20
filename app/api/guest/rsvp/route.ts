import { NextRequest, NextResponse } from 'next/server';
import { findGuestById } from '@/src/guest-auth/guestRepo.js';
import { listApprovedInvitees } from '@/src/invitees/inviteesRepo.js';
import { validateParticipantNames } from '@/src/invitees/validateInvitees.js';
import { saveInviteeRsvp, saveWholePartyRsvp } from '@/src/rsvp/saveRsvp.js';
import { authorizeRsvp } from '@/src/guest-auth/authorizeRsvp.js';
import { verifySession } from '@/src/session.js';
import { verifyCsrfToken } from '@/src/csrf.js';

type InviteeResponse = { id: string; attending: boolean };

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
    const { code, attending, participantNames, inviteeResponses } = body || {};

    const isInviteeSubmission = Array.isArray(inviteeResponses);
    if (!isInviteeSubmission && typeof attending !== 'boolean') {
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

    if (isInviteeSubmission) {
      const approvedInvitees: { id: string }[] = await listApprovedInvitees(guest.id);
      const approvedIds = new Set(approvedInvitees.map((i) => i.id));
      const valid = (inviteeResponses as InviteeResponse[]).filter(
        (entry) => entry && typeof entry.attending === 'boolean' && approvedIds.has(entry.id)
      );
      // A party with named invitees answers per person; see saveInviteeRsvp().
      // Everything it writes is one transaction — if any part fails it throws,
      // and the guest gets the error below rather than a false "saved".
      const result = await saveInviteeRsvp(guest.id, valid);
      return NextResponse.json({ success: true, rsvp: result });
    }

    // Legacy path: one accept/decline for the whole party, free-text names.
    const names = validateParticipantNames(participantNames);
    if (!names.valid) {
      return NextResponse.json(
        { success: false, reason: 'invalid_participant_names', message: names.error },
        { status: 400 }
      );
    }

    const result = await saveWholePartyRsvp(guest.id, {
      attending,
      participantNames: names.names,
    });

    return NextResponse.json({ success: true, rsvp: result });
  } catch (error) {
    console.error('RSVP error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'An error occurred while saving RSVP.' },
      { status: 500 }
    );
  }
}
