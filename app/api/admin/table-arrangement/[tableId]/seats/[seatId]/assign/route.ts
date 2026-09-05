import { NextRequest, NextResponse } from 'next/server';
import { assignGuestToSeat, assignProbableAttendeeToSeat } from '@/src/table-arrangement/tableArrangementRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ tableId: string; seatId: string }> };

/**
 * Assigns a seat to either a real Guest or a ProbableAttendee placeholder
 * (P1-14 / P1-16) — exactly one of guestId/probableAttendeeId is required.
 * Rejects if that occupant already holds another seat.
 */
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

  const { guestId, probableAttendeeId, dietaryRequirements, specialNotes } = body as {
    guestId?: string;
    probableAttendeeId?: string;
    dietaryRequirements?: string;
    specialNotes?: string;
  };

  if (!guestId && !probableAttendeeId) {
    return NextResponse.json({ success: false, message: 'Guest ID or probable attendee ID required.' }, { status: 400 });
  }
  if (guestId && probableAttendeeId) {
    return NextResponse.json({ success: false, message: 'Provide only one of guestId or probableAttendeeId.' }, { status: 400 });
  }

  try {
    const seat = probableAttendeeId
      ? await assignProbableAttendeeToSeat(seatId, probableAttendeeId, { dietaryRequirements, specialNotes })
      : await assignGuestToSeat(seatId, guestId, { dietaryRequirements, specialNotes });
    return NextResponse.json({ success: true, seat });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
  }
}
