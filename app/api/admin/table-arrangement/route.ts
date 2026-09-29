import { NextRequest, NextResponse } from 'next/server';
import { createSeatingTable, isUserFacingError } from '@/src/table-arrangement/tableArrangementRepo.js';
import { loadTableArrangementView } from '@/src/table-arrangement/loadTableArrangementView.js';
import { validateNewTable } from '@/src/table-arrangement/tableSides.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * Every seating table with its seats, accepted guests not yet seated (P1-14),
 * accepted individual invitees not yet seated (multi-person invitations,
 * 2026-09), the ProbableAttendee buffer state (P1-16), and the dashboard's
 * headline numbers — one read endpoint so the client's existing post-action
 * refresh picks all of it up for free. The stats were added for Next Action
 * 29: they used to be computed only at page load, so they went stale the
 * moment an admin seated anyone.
 *
 * Updated 2026-09-20: Filtered by party (bride or groom) for multi-admin support (P1-14H).
 * Updated 2026-09-28 (Action 68): the side's own tables plus every Common table,
 * each labelled with its `side`, and the leftover summary (counts only).
 */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const view = await loadTableArrangementView(session.party);
  return NextResponse.json({ success: true, ...view });
}

/**
 * Creates a seating table with `capacity` empty seats (P1-14). It needs a name,
 * unique across the venue ignoring capital letters, and a side: `side: "own"`
 * (the signed-in admin's side — the default) or `side: "common"` (Action 68).
 * A raw "bride" or "groom" is refused, so neither admin can make a table for the
 * other side.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

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

  const checked = validateNewTable(body, session.party);
  if (!checked.ok) {
    return NextResponse.json({ success: false, message: checked.message }, { status: 400 });
  }

  try {
    const table = await createSeatingTable(checked.value);
    return NextResponse.json({ success: true, table }, { status: 201 });
  } catch (error) {
    // Domain errors ("that table number/name is taken") are written for the admin
    // and pass through; anything else is a fault whose text could carry
    // Postgres detail, so it is logged and replaced (Next Action 34).
    if (isUserFacingError(error)) {
      return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
    }
    console.error('Failed to create seating table:', error);
    return NextResponse.json(
      { success: false, message: 'Could not create the table. Please try again.' },
      { status: 500 }
    );
  }
}
