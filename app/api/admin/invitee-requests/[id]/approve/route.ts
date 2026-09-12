import { NextRequest, NextResponse } from 'next/server';
import { approveInvitee } from '@/src/invitees/inviteesRepo.js';
import { incrementGuestSlotCount } from '@/src/admin/adminRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string }> };

/** Approves a guest's "add another person" request and grows their headcount by one. */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  const result = await approveInvitee(id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, reason: result.reason, message: 'Request not found.' },
      { status: 404 }
    );
  }

  await incrementGuestSlotCount(result.invitee.guestId);

  return NextResponse.json({ success: true, invitee: result.invitee });
}
