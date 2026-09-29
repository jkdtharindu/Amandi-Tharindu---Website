import { NextRequest, NextResponse } from 'next/server';
import { setMessageEventCompletion, getMessageEventsForGuest } from '@/src/messaging/messageEventsRepo.js';
import { listSeatingTablesByParty } from '@/src/table-arrangement/tableArrangementRepo.js';
import { tableLabelsByGuest } from '@/src/table-arrangement/guestTableView.js';
import { guestIsOnSide } from '@/src/admin/sideAccess.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

const guestNotFound = () =>
  NextResponse.json({ success: false, message: 'Guest not found.' }, { status: 404 });

/**
 * Ticks (or un-ticks) a message kind as sent for a guest, from the Messages
 * drop-down (P1-14G). POST body: { guestId, eventName, isCompleted? } —
 * isCompleted defaults to true; eventName examples: "RSVP Reminder",
 * "Thank You", "Table Details", "Final Reminder".
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

  const { guestId, eventName, isCompleted } = body as {
    guestId?: string;
    eventName?: string;
    isCompleted?: boolean;
  };

  if (!guestId || !eventName) {
    return NextResponse.json(
      { success: false, message: 'guestId and eventName are required.' },
      { status: 400 }
    );
  }
  if (!(await guestIsOnSide(guestId, session.party))) return guestNotFound();

  try {
    const event = await setMessageEventCompletion(
      guestId,
      eventName,
      session.party,
      isCompleted ?? true
    );
    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    console.error('Failed to record message event:', error);
    return NextResponse.json(
      { success: false, message: 'Could not record the message event.' },
      { status: 500 }
    );
  }
}

/**
 * A guest's message-kind completion state, plus `tableName` for the
 * [TableNumber] placeholder — the same `tableLabelsByGuest` the bulk Messaging
 * Center uses (Action 68), so this can never name a different table (P1-14G).
 * Query params: guestId
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const guestId = request.nextUrl.searchParams.get('guestId');
  if (!guestId) {
    return NextResponse.json(
      { success: false, message: 'guestId query parameter is required.' },
      { status: 400 }
    );
  }
  if (!(await guestIsOnSide(guestId, session.party))) return guestNotFound();

  try {
    const events = await getMessageEventsForGuest(guestId);

    // Never lets a seating hiccup take the drop-down down — same defensiveness
    // as the guest-facing invitation page that also calls listSeatingTables.
    let tableName = '';
    try {
      const tables = await listSeatingTablesByParty(session.party);
      tableName = (tableLabelsByGuest(tables).get(guestId) ?? []).join(', ');
    } catch (error) {
      console.error('Could not look up the table summary, omitting it:', error);
    }

    return NextResponse.json({ success: true, events, tableName });
  } catch (error) {
    console.error('Failed to get message events:', error);
    return NextResponse.json(
      { success: false, message: 'Could not fetch message events.' },
      { status: 500 }
    );
  }
}
