import { NextRequest, NextResponse } from 'next/server';
import { rejectInvitee } from '@/src/invitees/inviteesRepo.js';
import { inviteeIsOnSide } from '@/src/admin/sideAccess.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string }> };

/** Rejects a guest's "add another person" request. The row is kept, marked rejected, for audit. */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  if (!(await inviteeIsOnSide(id, session.party))) {
    return NextResponse.json(
      { success: false, reason: 'not_found', message: 'Request not found.' },
      { status: 404 }
    );
  }

  const result = await rejectInvitee(id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, reason: result.reason, message: 'Request not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, invitee: result.invitee });
}
