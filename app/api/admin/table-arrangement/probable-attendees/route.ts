import { NextRequest, NextResponse } from 'next/server';
import { setProbableAttendeeBuffer } from '@/src/table-arrangement/tableArrangementRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Resizes a Declined/Pending bucket's ProbableAttendee buffer (P1-16). */
export async function PUT(request: NextRequest): Promise<NextResponse> {
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

  const { bucket, count } = body as { bucket?: string; count?: number };

  if (bucket !== 'declined' && bucket !== 'pending') {
    return NextResponse.json({ success: false, message: 'Bucket must be "declined" or "pending".' }, { status: 400 });
  }

  try {
    const summary = await setProbableAttendeeBuffer(bucket, count);
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
  }
}
