import { NextRequest, NextResponse } from 'next/server';
import {
  updateSeatingTable,
  deleteSeatingTable,
  isUserFacingError,
} from '@/src/table-arrangement/tableArrangementRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ tableId: string }> };

/** Renames a seating table (P1-14). */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { tableId } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  try {
    const table = await updateSeatingTable(tableId, { tableName: body.tableName as string | undefined });
    if (!table) {
      return NextResponse.json({ success: false, message: 'Table not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, table });
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
    }
    console.error('Failed to update seating table:', error);
    return NextResponse.json(
      { success: false, message: 'Could not update the table. Please try again.' },
      { status: 500 }
    );
  }
}

/** Deletes a seating table and all its seats (P1-14). */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { tableId } = await context.params;

  try {
    await deleteSeatingTable(tableId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
    }
    console.error('Failed to delete seating table:', error);
    return NextResponse.json(
      { success: false, message: 'Could not delete the table. Please try again.' },
      { status: 500 }
    );
  }
}
