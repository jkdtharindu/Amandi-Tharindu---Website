import { NextRequest, NextResponse } from 'next/server';
import { getInviteeById } from '@/src/invitees/inviteesRepo.js';
import { removeInviteeFromParty } from '@/src/invitees/removeInvitee.js';
import { renameInviteeInParty, MAX_PERSON_NAME_LENGTH } from '@/src/invitees/renameInvitee.js';
import { guestIsOnSide } from '@/src/admin/sideAccess.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string; inviteeId: string }> };

const notFound = () =>
  NextResponse.json(
    { success: false, reason: 'invitee_not_found', message: 'That person no longer exists.' },
    { status: 404 }
  );

/**
 * Removes one named person from an existing party. Frees any seat they held
 * (Next Action 22 — until this route existed, the only "Remove" button on the
 * Guest list deleted the whole party and never touched table_seats at all),
 * then re-derives the party's rsvp_status and slot_count from whoever is left.
 *
 * All of it is one all-or-nothing transaction (Next Action 50): if any step
 * fails nothing changes and the admin is told to try again. Removing the last
 * approved person is refused with a 409 — remove the whole party instead.
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id, inviteeId } = await context.params;

  // Answered here, before the transaction: a malformed guest id would make
  // Postgres reject the row lock with an error instead of a clean "not found".
  const invitee = await getInviteeById(inviteeId);
  if (!invitee || invitee.guestId !== id) return notFound();
  if (!(await guestIsOnSide(id, session.party))) return notFound();

  let result;
  try {
    result = await removeInviteeFromParty(id, inviteeId);
  } catch (error) {
    console.error('Removing an invitee failed; nothing was changed:', error);
    return NextResponse.json(
      {
        success: false,
        reason: 'remove_failed',
        message: 'Could not remove that person. Nothing was changed — please try again.',
      },
      { status: 500 }
    );
  }

  if (!result.success) {
    if (result.reason === 'last_invitee') {
      return NextResponse.json(
        {
          success: false,
          reason: 'last_invitee',
          message:
            "That is the last person on this invitation. To take the whole invitation off the list, use Remove on the guest's row instead.",
        },
        { status: 409 }
      );
    }
    return notFound();
  }

  return NextResponse.json({ success: true, invitees: result.invitees });
}

/**
 * Renames one person on an invitation. Body: { name }. Used when the real name
 * of a plus-one is learned after the invitation was sent. Changes the person's
 * name only: their seat, RSVP answer and the party's code are untouched.
 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id, inviteeId } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const invitee = await getInviteeById(inviteeId);
  if (!invitee || invitee.guestId !== id) return notFound();
  if (!(await guestIsOnSide(id, session.party))) return notFound();

  let result;
  try {
    result = await renameInviteeInParty(id, inviteeId, typeof body.name === 'string' ? body.name : '');
  } catch (error) {
    console.error('Renaming an invitee failed; nothing was changed:', error);
    return NextResponse.json(
      { success: false, reason: 'rename_failed', message: 'Could not save that name. Nothing was changed — please try again.' },
      { status: 500 }
    );
  }

  if (!result.success) {
    if (result.reason === 'invalid_name') {
      return NextResponse.json(
        { success: false, reason: 'invalid_name', message: `Enter a name (up to ${MAX_PERSON_NAME_LENGTH} characters).` },
        { status: 400 }
      );
    }
    return notFound();
  }

  return NextResponse.json({ success: true, invitees: result.invitees });
}
