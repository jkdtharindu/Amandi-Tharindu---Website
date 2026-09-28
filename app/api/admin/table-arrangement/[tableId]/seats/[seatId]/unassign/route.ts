import { NextRequest, NextResponse } from 'next/server';
import {
  unassignGuestFromSeat,
  isUserFacingError,
} from '@/src/table-arrangement/tableArrangementRepo.js';
import { seatIsOnSideTable } from '@/src/admin/sideAccess.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ tableId: string; seatId: string }> };

/** Frees a seat on one of the signed-in side's tables so its guest can be reassigned elsewhere (P1-14). */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { tableId, seatId } = await context.params;
  if (!(await seatIsOnSideTable(tableId, seatId, session.party))) {
    return NextResponse.json({ success: false, message: 'Seat not found.' }, { status: 404 });
  }

  try {
    const seat = await unassignGuestFromSeat(seatId);
    return NextResponse.json({ success: true, seat });
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
    }
    console.error('Failed to unassign seat:', error);
    return NextResponse.json(
      { success: false, message: 'Could not free that seat. Please try again.' },
      { status: 500 }
    );
  }
}
