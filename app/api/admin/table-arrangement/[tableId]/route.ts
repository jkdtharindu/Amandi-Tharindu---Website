import { NextRequest, NextResponse } from 'next/server';
import {
  updateSeatingTable,
  deleteSeatingTable,
  userFacingStatus,
} from '@/src/table-arrangement/tableArrangementRepo.js';
import { visibleTableSide } from '@/src/admin/sideAccess.js';
import { COMMON, validateTableUpdate } from '@/src/table-arrangement/tableSides.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ tableId: string }> };

const tableNotFound = () => NextResponse.json({ success: false, message: 'Table not found.' }, { status: 404 });

/**
 * Renames a table and/or changes its side (P1-14; sides are Action 68). Works on
 * the signed-in side's own tables and on Common tables; the other side's tables
 * answer 404. `side` is "own" or "common", never a raw side name, and a table's
 * side can change only while nobody is seated at it (409 otherwise).
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { tableId } = await context.params;
  if (!(await visibleTableSide(tableId, session.party))) return tableNotFound();

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const checked = validateTableUpdate(body, session.party);
  if (!checked.ok) {
    return NextResponse.json({ success: false, message: checked.message }, { status: 400 });
  }

  try {
    const table = await updateSeatingTable(tableId, checked.value);
    if (!table) return tableNotFound();
    return NextResponse.json({ success: true, table });
  } catch (error) {
    // "that name is taken" (400) and "people are seated" (409) are the admin's
    // answer; anything else could carry Postgres detail (Next Action 34).
    const status = userFacingStatus(error);
    if (status) {
      return NextResponse.json({ success: false, message: (error as Error).message }, { status });
    }
    console.error('Failed to update seating table:', error);
    return NextResponse.json(
      { success: false, message: 'Could not update the table. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Deletes a table and all its seats (P1-14). The signed-in side's own table is
 * deleted as before and its people become unseated. A Common table is deleted
 * by either side, but only while nobody sits at it (409 otherwise), so neither
 * side can unseat the other's people by deleting the table under them (Action 68).
 * The other side's own tables answer 404.
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { tableId } = await context.params;
  const side = await visibleTableSide(tableId, session.party);
  if (!side) return tableNotFound();

  try {
    await deleteSeatingTable(tableId, { onlyIfEmpty: side === COMMON });
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = userFacingStatus(error);
    if (status) {
      return NextResponse.json({ success: false, message: (error as Error).message }, { status });
    }
    console.error('Failed to delete seating table:', error);
    return NextResponse.json(
      { success: false, message: 'Could not delete the table. Please try again.' },
      { status: 500 }
    );
  }
}
