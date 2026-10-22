import { NextRequest, NextResponse } from 'next/server';
import { saveTemplate } from '@/src/messaging/messageTemplatesRepo.js';
import { MESSAGE_LEVELS } from '@/src/messaging/messageLevels.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

const MAX_BODY_LENGTH = 2000;

/**
 * Saves the wording for one message level. Body: { levelKey, body }. Passing an
 * empty body is refused; "Reset to default" sends the level's default wording
 * instead. The wording is shared by both sides (the templates table has no side).
 * Placeholders like [Name], [Code] and [TableNumber] are filled per guest when a
 * message is opened, so they are saved as typed.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
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

  const level = MESSAGE_LEVELS.find((entry) => entry.key === body.levelKey);
  if (!level) {
    return NextResponse.json({ success: false, message: 'Unknown message level.' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ success: false, message: 'The message cannot be empty.' }, { status: 400 });
  }
  if (text.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { success: false, message: `The message is too long (max ${MAX_BODY_LENGTH} characters).` },
      { status: 400 }
    );
  }

  try {
    const template = await saveTemplate(level.templateName, text);
    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Failed to save message template:', error);
    return NextResponse.json({ success: false, message: 'Could not save the template.' }, { status: 500 });
  }
}
