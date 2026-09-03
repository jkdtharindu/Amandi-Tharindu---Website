import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCredentials } from '@/src/admin/adminAuth.js';
import { ADMIN_COOKIE_NAME, createAdminSession } from '@/src/admin/adminSession.js';
import { verifyCsrfToken } from '@/src/csrf.js';

/**
 * Admin login (PRD P0-09).
 *
 * Throttling note: the attempt counter below is in-process, so it protects a
 * single server instance and resets on redeploy. Move it to a shared store
 * (Redis/Postgres) before this runs behind more than one instance.
 */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function clearThrottle(key: string): void {
  attempts.delete(key);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
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

  const clientKey =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';

  if (throttled(clientKey)) {
    return NextResponse.json(
      {
        success: false,
        reason: 'too_many_attempts',
        message: 'Too many login attempts. Please wait 15 minutes and try again.',
      },
      { status: 429 }
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

  clearThrottle(clientKey);

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
