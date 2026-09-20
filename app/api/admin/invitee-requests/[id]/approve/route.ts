import { NextRequest, NextResponse } from 'next/server';
import { approveInviteeRequest } from '@/src/invitees/approveInviteeRequest.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Approves a guest's "add another person" request, grows their headcount by one and
 * re-derives the party's RSVP status — all in one transaction (Next Action 55).
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  let result;
  try {
    result = await approveInviteeRequest(id);
  } catch (error) {
    console.error('Approving an invitee request failed; nothing was changed:', error);
    return NextResponse.json(
      {
        success: false,
        reason: 'approve_failed',
        message: 'Could not approve the request. Nothing was changed — please try again.',
      },
      { status: 500 }
    );
  }

  if (!result.success) {
    if (result.reason === 'guest_removed') {
      return NextResponse.json(
        { success: false, reason: result.reason, message: 'That guest has been removed, so their request cannot be approved.' },
        { status: 409 }
      );
    }
    if (result.reason === 'not_pending') {
      return NextResponse.json(
        { success: false, reason: result.reason, message: 'That request has already been handled.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, reason: result.reason, message: 'Request not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, invitee: result.invitee });
}
