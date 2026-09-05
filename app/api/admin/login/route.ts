import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCredentials } from '@/src/admin/adminAuth.js';
import { ADMIN_COOKIE_NAME, createAdminSession } from '@/src/admin/adminSession.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import {
  ADMIN_LOGIN_LIMIT,
  checkAuthRateLimit,
  clearAuthRateLimit,
} from '@/src/security/authRateLimit.js';

/**
 * Admin login (PRD P0-09).
 *
 * Throttling is in-process: it protects a single server instance and resets on
 * redeploy. Move it to a shared store (Redis/Postgres) before this runs behind
 * more than one instance — TASKS.md Next Action 8.
 */
const ENDPOINT = '/api/admin/login';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  // Checked before the body is read, so a caller cannot dodge the throttle by
  // sending an unparseable body — same ordering as /api/guest/login.
  const rateLimit = checkAuthRateLimit(request.headers, ENDPOINT, ADMIN_LOGIN_LIMIT);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        reason: 'too_many_attempts',
        message: 'Too many login attempts. Please wait 15 minutes and try again.',
      },
      { status: 429, headers: rateLimit.headers }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const result = verifyAdminCredentials(body?.email, body?.password);
  if (!result.success) {
    return NextResponse.json(result, {
      status: result.reason === 'admin_not_configured' ? 500 : 401,
    });
  }

  let token: string;
  try {
    token = createAdminSession(String(body.email).trim().toLowerCase());
  } catch {
    return NextResponse.json(
      {
        success: false,
        reason: 'admin_not_configured',
        message: 'SESSION_SECRET is not set on this server.',
      },
      { status: 500 }
    );
  }

  clearAuthRateLimit(rateLimit.identifier, ENDPOINT);

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
