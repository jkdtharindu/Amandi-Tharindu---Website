import { NextRequest, NextResponse } from 'next/server';
import {
  unassignGuestFromSeat,
  isUserFacingError,
} from '@/src/table-arrangement/tableArrangementRepo.js';
import { seatRemovalRefusal } from '@/src/table-arrangement/seatingRules.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ tableId: string; seatId: string }> };

/**
 * Frees a seat so its guest can be reassigned elsewhere (P1-14). Any seat at the
 * signed-in side's own tables; at a Common table only the side's own people and
 * placeholders — the other side's person there is refused with 403 (PRD §20,
 * Action 68 — src/table-arrangement/seatingRules.js).
 */
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
  const refusal = await seatRemovalRefusal({ tableId, seatId, party: session.party });
  if (refusal) return NextResponse.json({ success: false, message: refusal.message }, { status: refusal.status });

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
