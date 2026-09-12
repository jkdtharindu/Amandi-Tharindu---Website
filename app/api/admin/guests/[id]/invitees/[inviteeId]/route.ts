import { NextRequest, NextResponse } from 'next/server';
import {
  getInviteeById,
  deleteInvitee,
  listApprovedInvitees,
  deriveGuestRsvpStatus,
} from '@/src/invitees/inviteesRepo.js';
import { unassignSeatByInviteeId } from '@/src/table-arrangement/tableArrangementRepo.js';
import { updateGuestRsvpStatus, upsertRsvpResponse } from '@/src/guest-auth/guestRepo.js';
import { syncGuestSlotCountToInvitees } from '@/src/admin/adminRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string; inviteeId: string }> };
type InviteeRow = { id: string; name: string; rsvpStatus: string };

/**
 * Removes one named person from an existing party. Frees any seat they held
 * (Next Action 22 — until this route existed, the only "Remove" button on the
 * Guest list deleted the whole party and never touched table_seats at all),
 * then re-derives the party's rsvp_status and slot_count from whoever is left,
 * the same way accepting/declining/approving a request already does.
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id, inviteeId } = await context.params;

  const invitee = await getInviteeById(inviteeId);
  if (!invitee || invitee.guestId !== id) {
    return NextResponse.json(
      { success: false, reason: 'invitee_not_found', message: 'That person no longer exists.' },
      { status: 404 }
    );
  }

  await unassignSeatByInviteeId(inviteeId);
  await deleteInvitee(inviteeId);

  const remaining: InviteeRow[] = await listApprovedInvitees(id);
  const status = deriveGuestRsvpStatus(remaining);
  const acceptedNames = remaining.filter((i) => i.rsvpStatus === 'accepted').map((i) => i.name);

  try {
    await upsertRsvpResponse(id, status === 'accepted', acceptedNames);
    await updateGuestRsvpStatus(id, status);
  } catch (statusError) {
    console.error('RSVP status re-derive failed after removing an invitee:', statusError);
  }

  await syncGuestSlotCountToInvitees(id);

  return NextResponse.json({ success: true, invitees: remaining });
}
