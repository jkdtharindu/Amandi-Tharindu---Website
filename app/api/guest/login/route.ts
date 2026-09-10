import { NextRequest, NextResponse } from 'next/server';
import { loginGuestByCode } from '@/src/guest-auth/index.js';
import { normalizeInvitationCode } from '@/src/guest-auth/normalizeInvitationCode.js';
import { guestSessionMaxAgeSeconds, signSession } from '@/src/session.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { clientKey, createGuestLoginLimiter } from '@/src/rate-limiter.js';

const guestLoginLimiter = createGuestLoginLimiter();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify CSRF token
    if (!verifyCsrfToken(request)) {
      return NextResponse.json(
        { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
        { status: 403 }
      );
    }

    // InvitationCodes are guessable by design (they are printed on a card and
    // read aloud), so the only thing standing between an outsider and the guest
    // list is this counter.
    const rateLimit = guestLoginLimiter.check(clientKey(request));
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, reason: 'too_many_attempts', message: 'Too many login attempts. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
        { status: 400 }
      );
    }

    // Code only. Name login was removed with the site gate (PRD §15, owner
    // decision 2026-09-10): anyone who knew a guest's name could sign in as them.
    const code = normalizeInvitationCode(body?.code);
    if (!code) {
      return NextResponse.json(
        { success: false, reason: 'code_required' },
        { status: 400 }
      );
    }

    const result = await loginGuestByCode(code);
    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    const signed = signSession(result.sessionId);
    const response = NextResponse.json(result);
    response.cookies.set('guest_session', signed, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: guestSessionMaxAgeSeconds(),
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'An error occurred during login.' },
      { status: 500 }
    );
  }
}
