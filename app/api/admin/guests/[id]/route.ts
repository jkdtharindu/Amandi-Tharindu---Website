import { NextRequest, NextResponse } from 'next/server';
import { updateGuestDetails } from '@/src/admin/updateGuestDetails.js';
import { removeGuest } from '@/src/admin/removeGuest.js';
import { validateGuestInput } from '@/src/admin/guestValidation.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json(
    { success: false, reason: 'guest_not_found', message: 'That guest no longer exists.' },
    { status: 404 }
  );

/** Edits a guest's details. The invitation code is immutable (P0-07, P1-14D).
 *  Updated 2026-09-20: Verifies the guest belongs to the requesting admin's party.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const validation = validateGuestInput(body);
  const value = validation.value;
  if (!validation.valid || !value) {
    return NextResponse.json(
      {
        success: false,
        reason: 'validation_failed',
        message: 'Please correct the highlighted fields.',
        errors: validation.errors,
      },
      { status: 400 }
    );
  }

  const guest = await updateGuestDetails(id, value, session.party);
  if (!guest) return notFound();

  return NextResponse.json({ success: true, guest });
}

/**
 * Soft-deletes a guest, preserving their RSVP history (PRD §7), and frees every
 * table seat the guest or any of their people held — in one transaction, so a
 * removed guest can never stay on a seat (Next Action 56). Verifies party ownership (P1-14D).
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  let guest;
  try {
    guest = await removeGuest(id, { party: session.party });
  } catch (error) {
    console.error('Removing a guest failed; nothing was changed:', error);
    return NextResponse.json(
      {
        success: false,
        reason: 'remove_failed',
        message: 'Could not remove the guest. Nothing was changed — please try again.',
      },
      { status: 500 }
    );
  }

  return guest ? NextResponse.json({ success: true, guest }) : notFound();
}
