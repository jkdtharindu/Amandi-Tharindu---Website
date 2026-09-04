import { NextRequest, NextResponse } from 'next/server';
import { listEvents, createEvent } from '@/src/celebration-events/celebrationEventsRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** All celebration events, ordered for display (P1-09). */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const events = await listEvents();
  return NextResponse.json({ success: true, events });
}

/** Creates a celebration event (P1-09). */
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

  const result = await createEvent(body);
  if (!result.success) {
    const errors = 'errors' in result ? result.errors : undefined;
    return NextResponse.json(
      { success: false, reason: 'validation_failed', message: 'Please correct the highlighted fields.', errors },
      { status: 400 }
    );
  }
  return NextResponse.json(result, { status: 201 });
}
