import { NextRequest, NextResponse } from 'next/server';
import {
  findGuestById,
  updateGuestRsvpStatus,
  upsertRsvpResponse,
} from '@/src/guest-auth/guestRepo.js';
import {
  listApprovedInvitees,
  updateInviteeRsvpStatuses,
  deriveGuestRsvpStatus,
} from '@/src/invitees/inviteesRepo.js';
import { validateParticipantNames } from '@/src/invitees/validateInvitees.js';
import { authorizeRsvp } from '@/src/guest-auth/authorizeRsvp.js';
import { verifySession } from '@/src/session.js';
import { verifyCsrfToken } from '@/src/csrf.js';

type InviteeResponse = { id: string; attending: boolean };

/**
 * A guest with named invitees (multi-person invitation, 2026-09) accepts or
 * declines per person instead of one status for the whole party. The party's
 * own rsvp_status is then derived from those, and mirrored into
 * rsvp_responses so every existing reader (CSV export, dashboard stats) keeps
 * working without changes.
 */
type InviteeRow = { id: string; name: string; rsvpStatus: string; approvalStatus: string };

async function handleInviteeRsvp(guestId: string, inviteeResponses: InviteeResponse[]) {
  const updated: InviteeRow[] = await updateInviteeRsvpStatuses(guestId, inviteeResponses);
  const status = deriveGuestRsvpStatus(updated);

  const acceptedNames = updated.filter((i) => i.rsvpStatus === 'accepted').map((i) => i.name);
  const result = await upsertRsvpResponse(guestId, status === 'accepted', acceptedNames);

  try {
    await updateGuestRsvpStatus(guestId, status);
  } catch (statusError) {
    console.error('RSVP status update failed after response was saved:', statusError);
  }

  return result;
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
      const valid = (inviteeResponses as InviteeResponse[]).filter(
        (entry) => entry && typeof entry.attending === 'boolean' && approvedIds.has(entry.id)
      );
      const result = await handleInviteeRsvp(guest.id, valid);
      return NextResponse.json({ success: true, rsvp: result });
    }

    // Legacy path: one accept/decline for the whole party, free-text names.
    // Both calls together: if one fails, the guest's RSVP is inconsistent.
    // Currently they're separate DB calls (not in a transaction). For now, catch
    // failures from both and treat the RSVP response as the source of truth, so at
    // least that part never silently fails.
    const names = validateParticipantNames(participantNames);
    if (!names.valid) {
      return NextResponse.json(
        { success: false, reason: 'invalid_participant_names', message: names.error },
        { status: 400 }
      );
    }

    const result = await upsertRsvpResponse(
      guest.id,
      attending,
      attending ? names.names : []
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
