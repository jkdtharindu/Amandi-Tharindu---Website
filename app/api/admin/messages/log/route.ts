import { NextRequest, NextResponse } from 'next/server';
import { listTemplates } from '@/src/messaging/messageTemplatesRepo.js';
import { logMessage, listRecentLogsByParty, decorateLogs } from '@/src/messaging/messageLogRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

const RECENT_LIMIT = 20;

/** The signed-in side's recent message log entries, with guest and template detail joined on. */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const [logs, templates] = await Promise.all([
    listRecentLogsByParty(session.party, RECENT_LIMIT),
    listTemplates(),
  ]);

  return NextResponse.json({ success: true, logs: decorateLogs(logs, [], templates) });
}

/**
 * Records that the admin opened WhatsApp for a guest (P1-07).
 *
 * This is not a send: the wa.me link only pre-fills the message and the admin
 * presses Send inside WhatsApp. The log tracks who has been worked through.
 */
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

  const guestId = typeof body.guestId === 'string' ? body.guestId : '';
  if (!guestId) {
    return NextResponse.json(
      { success: false, reason: 'guest_required', message: 'A guest is required.' },
      { status: 400 }
    );
  }

  const entry = await logMessage({
    guestId,
    templateId: typeof body.templateId === 'string' && body.templateId ? body.templateId : null,
    channel: 'whatsapp',
  });

  return NextResponse.json({ success: true, entry }, { status: 201 });
}
