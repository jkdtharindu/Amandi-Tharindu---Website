import { NextRequest, NextResponse } from 'next/server';
import {
  softDeleteGuest,
  updateGuest,
  syncGuestSlotCountToInvitees,
} from '@/src/admin/adminRepo.js';
import { listApprovedInvitees } from '@/src/invitees/inviteesRepo.js';
import { validateGuestInput } from '@/src/admin/guestValidation.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json(
    { success: false, reason: 'guest_not_found', message: 'That guest no longer exists.' },
    { status: 404 }
  );

/** Edits a guest's details. The invitation code is immutable (P0-07). */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

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

  const guest = await updateGuest(id, value);
  if (!guest) return notFound();

  // A party with named invitees derives its seat count from that list, so the
  // body's slotCount is not authoritative here. The edit form disables the
  // field but submits whatever it held when the form opened, so removing an
  // invitee and then saving an unrelated field (a phone number, say) used to
  // write the pre-removal count straight back — reintroducing exactly the
  // drift Next Action 22 fixed for the removal endpoint (Next Action 32).
  const approved = await listApprovedInvitees(id);
  if (approved.length > 0) {
    const synced = await syncGuestSlotCountToInvitees(id);
    if (synced) return NextResponse.json({ success: true, guest: synced });
  }

  return NextResponse.json({ success: true, guest });
}

/** Soft-deletes a guest, preserving their RSVP history (PRD §7). */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const guest = await softDeleteGuest(id);
  return guest ? NextResponse.json({ success: true, guest }) : notFound();
}
