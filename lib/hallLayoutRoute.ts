import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';
import { isHallLayoutError, isHallLayoutMissing } from '@/src/hall-layout/hallLayoutRepo.js';

/** The checks and error replies every hall layout route shares. The map is one shared layout, so no side applies. */

export const MISSING_LAYOUT_MESSAGE =
  'The hall layout needs a database update first (npm run migrate).';

export function hallFail(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

export function hallFault(error: unknown, action: string): NextResponse {
  if (isHallLayoutMissing(error)) return hallFail(MISSING_LAYOUT_MESSAGE, 503);
  if (isHallLayoutError(error)) return hallFail((error as Error).message, 409);
  // Anything else could carry database detail (Next Action 34): log it, say little.
  console.error(`Failed to ${action}:`, error);
  return hallFail(`Could not ${action}. Please try again.`, 500);
}

/** For a change: a signed-in admin, a valid CSRF token and (unless there is no body) a JSON body. */
export async function readHallChange(
  request: NextRequest,
  { body: needsBody = true }: { body?: boolean } = {}
): Promise<{ refusal: NextResponse } | { refusal: null; body: Record<string, unknown> }> {
  if (!(await getAdminSession())) return { refusal: unauthorizedResponse() };
  if (!verifyCsrfToken(request)) {
    return {
      refusal: NextResponse.json(
        { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
        { status: 403 }
      ),
    };
  }
  if (!needsBody) return { refusal: null, body: {} };
  try {
    return { refusal: null, body: await request.json() };
  } catch {
    return { refusal: hallFail('Invalid request body.', 400) };
  }
}
