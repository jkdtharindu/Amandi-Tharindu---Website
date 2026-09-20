import { NextRequest, NextResponse } from 'next/server';
import { recordMessageEvent, getMessageEventsForGuest } from '@/src/admin/adminRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * Record a message event as sent (P1-14G).
 * POST body: { guestId, eventName }
 * eventName examples: "RSVP Reminder", "Thank You", "Table Details", "Final Reminder"
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

  const { guestId, eventName } = body as { guestId?: string; eventName?: string };

  if (!guestId || !eventName) {
    return NextResponse.json(
      { success: false, message: 'guestId and eventName are required.' },
      { status: 400 }
    );
  }

  try {
    const event = await recordMessageEvent(guestId, eventName, session.party);
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
 * Get message events for a guest (P1-14G).
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

  try {
    const events = await getMessageEventsForGuest(guestId);
    return NextResponse.json({ success: true, events });
  } catch (error) {
    console.error('Failed to get message events:', error);
    return NextResponse.json(
      { success: false, message: 'Could not fetch message events.' },
      { status: 500 }
    );
  }
}
