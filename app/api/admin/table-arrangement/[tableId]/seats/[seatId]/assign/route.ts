import { NextRequest, NextResponse } from 'next/server';
import { assignGuestToSeat } from '@/src/table-arrangement/tableArrangementRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ tableId: string; seatId: string }> };

/** Assigns a guest to a seat; rejects if that guest already holds another seat (P1-14). */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { seatId } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const { guestId, dietaryRequirements, specialNotes } = body as {
    guestId?: string;
    dietaryRequirements?: string;
    specialNotes?: string;
  };

  if (!guestId) {
    return NextResponse.json({ success: false, message: 'Guest ID required.' }, { status: 400 });
  }

  try {
    const seat = await assignGuestToSeat(seatId, guestId, { dietaryRequirements, specialNotes });
    return NextResponse.json({ success: true, seat });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
  }
}
