import { NextRequest, NextResponse } from 'next/server';
import { listApprovedInvitees, createInviteesForGuest } from '@/src/invitees/inviteesRepo.js';
import { validateInviteeNames } from '@/src/invitees/validateInvitees.js';
import { syncGuestSlotCountToInvitees } from '@/src/admin/adminRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string }> };

/** The named people in a party, for the "remove a person" control on the Guest list page. */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const { id } = await context.params;
  const invitees = await listApprovedInvitees(id);
  return NextResponse.json({ success: true, invitees });
}

/** Adds new people to an existing party and syncs the guest's headcount. */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
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

  const namesValidation = validateInviteeNames(body.names);
  if (!namesValidation.valid) {
    return NextResponse.json(
      { success: false, reason: 'validation_failed', message: namesValidation.error },
      { status: 400 }
    );
  }

  try {
    await createInviteesForGuest(id, namesValidation.names, {
      addedBy: 'admin',
      approvalStatus: 'approved',
    });
    await syncGuestSlotCountToInvitees(id);
    const invitees = await listApprovedInvitees(id);
    return NextResponse.json({ success: true, invitees });
  } catch (error) {
    console.error('Adding invitees failed:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'Could not add those people.' },
      { status: 500 }
    );
  }
}
