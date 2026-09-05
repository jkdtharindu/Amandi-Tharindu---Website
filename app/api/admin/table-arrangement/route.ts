import { NextRequest, NextResponse } from 'next/server';
import {
  listSeatingTables,
  createSeatingTable,
  listUnassignedGuests,
  listUnassignedProbableAttendees,
  getProbableAttendanceSummary,
} from '@/src/table-arrangement/tableArrangementRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * Every seating table with its seats, accepted guests not yet seated (P1-14),
 * and the ProbableAttendee buffer state (P1-16) — one read endpoint so the
 * client's existing post-action refresh picks up buffer changes for free.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const [tables, unassignedGuests, unassignedProbableAttendees, probableAttendanceSummary] = await Promise.all([
    listSeatingTables(),
    listUnassignedGuests(),
    listUnassignedProbableAttendees(),
    getProbableAttendanceSummary(),
  ]);
  return NextResponse.json({
    success: true,
    tables,
    unassignedGuests,
    unassignedProbableAttendees,
    probableAttendanceSummary,
  });
}

/** Creates a seating table with `capacity` empty seats (P1-14). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const { tableNumber, tableName, capacity } = body as {
    tableNumber?: number;
    tableName?: string;
    capacity?: number;
  };

  if (!tableNumber || tableNumber < 1) {
    return NextResponse.json({ success: false, message: 'Valid table number required.' }, { status: 400 });
  }
  if (!capacity || capacity < 1 || capacity > 100) {
    return NextResponse.json({ success: false, message: 'Capacity must be between 1 and 100.' }, { status: 400 });
  }

  try {
    const table = await createSeatingTable({ tableNumber, tableName, capacity });
    return NextResponse.json({ success: true, table }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
  }
}
