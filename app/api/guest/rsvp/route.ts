import { NextRequest, NextResponse } from 'next/server';
import { findGuestById } from '@/src/guest-auth/guestRepo.js';
import { listApprovedInvitees, listInviteesForGuest } from '@/src/invitees/inviteesRepo.js';
import { validateParticipantNames } from '@/src/invitees/validateInvitees.js';
import { saveInviteeRsvp, saveWholePartyRsvp } from '@/src/rsvp/saveRsvp.js';
import { answeredByLabel, clientIpFrom } from '@/src/rsvp/answeredBy.js';
import { authorizeRsvp } from '@/src/guest-auth/authorizeRsvp.js';
import { verifySession } from '@/src/session.js';
import { verifyCsrfToken } from '@/src/csrf.js';

type InviteeResponse = {
  id: string;
  attending: boolean;
  expectedStatus?: 'pending' | 'accepted' | 'declined';
  /** The guest said yes to "change <name>'s answer, which another device gave?". */
  confirmed?: boolean;
};

const STATUSES = new Set(['pending', 'accepted', 'declined']);

/** What the page needs to draw one person: no guest id, no timestamps. */
function publicInvitee(invitee: Record<string, unknown>) {
  return {
    id: invitee.id,
    name: invitee.name,
    rsvpStatus: invitee.rsvpStatus,
    addedBy: invitee.addedBy,
    approvalStatus: invitee.approvalStatus,
    displayOrder: invitee.displayOrder,
  };
}

/**
 * The saved answers for the signed-in guest's party, read fresh. The page calls
 * this on load and when the tab comes back into view, so answers another person
 * saved from their own phone show up without a manual reload.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionGuestId = verifySession(request.cookies.get('guest_session')?.value);
    const guest = sessionGuestId ? await findGuestById(sessionGuestId) : null;
    if (!guest) {
      return NextResponse.json({ success: false, reason: 'not_signed_in' }, { status: 401 });
    }
    const invitees = await listInviteesForGuest(guest.id);
    return NextResponse.json(
      { success: true, invitees: invitees.map(publicInvitee) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('RSVP read error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'Could not load your answers.' },
      { status: 500 }
    );
  }
}

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
      const valid: InviteeResponse[] = [];
      for (const entry of inviteeResponses as InviteeResponse[]) {
        if (!entry || typeof entry.attending !== 'boolean' || !approvedIds.has(entry.id)) continue;
        valid.push({
          id: entry.id,
          attending: entry.attending,
          expectedStatus: STATUSES.has(entry.expectedStatus as string) ? entry.expectedStatus : undefined,
          confirmed: entry.confirmed === true,
        });
      }
      if (valid.length === 0) {
        return NextResponse.json({ success: false, reason: 'nothing_to_save' }, { status: 400 });
      }
      // Only the people sent here are written; everyone else keeps their saved
      // answer. See saveInviteeRsvp(). Everything it writes is one transaction
      // -- if any part fails it throws, and the guest gets the error below
      // rather than a false "saved".
      const result = await saveInviteeRsvp(guest.id, valid, {
        answeredBy: answeredByLabel(clientIpFrom(request.headers)),
      });
      const invitees = await listInviteesForGuest(guest.id);
      // Changes held back because another device gave the saved answer: the page
      // asks the guest to confirm, by name, then sends them again.
      const needsConfirm = result.needsConfirm.map((id: string) => ({
        id,
        name: invitees.find((invitee: { id: string }) => invitee.id === id)?.name ?? '',
      }));
      return NextResponse.json({
        success: true,
        status: result.status,
        conflicts: result.conflicts,
        needsConfirm,
        invitees: invitees.map(publicInvitee),
      });
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
