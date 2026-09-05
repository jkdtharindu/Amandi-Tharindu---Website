import { NextRequest, NextResponse } from 'next/server';
import { loginGuestByCode, loginGuestByName } from '@/src/guest-auth/index.js';
import { signSession } from '@/src/session.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { GUEST_LOGIN_LIMIT, checkAuthRateLimit } from '@/src/security/authRateLimit.js';

const ENDPOINT = '/api/guest/login';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify CSRF token
    if (!verifyCsrfToken(request)) {
      return NextResponse.json(
        { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
        { status: 403 }
      );
    }

    // Invitation codes and guest names are both guessable, so this endpoint is
    // the brute-force surface for the whole guest list. A successful login
    // deliberately does not refund the budget: one valid code would otherwise
    // buy unlimited guesses at every other guest's.
    const rateLimit = checkAuthRateLimit(request.headers, ENDPOINT, GUEST_LOGIN_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          reason: 'too_many_attempts',
          message: 'Too many attempts. Please wait a few minutes and try again.',
        },
        { status: 429, headers: rateLimit.headers }
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
    const { code, name } = body || {};

    if (!code && !name) {
      return NextResponse.json(
        { success: false, reason: 'missing_identifier' },
        { status: 400 }
      );
    }

    let result;
    if (code) {
      result = await loginGuestByCode(code);
      if (!result.success) {
        return NextResponse.json(result, { status: 404 });
      }
    } else {
      result = await loginGuestByName(name);
      if (result.type === 'candidates') {
        return NextResponse.json(result, { status: 200 });
      }
      if (!result.success) {
        return NextResponse.json(result, { status: 404 });
      }
    }

    const signed = signSession(result.sessionId);
    const response = NextResponse.json(result);
    response.cookies.set('guest_session', signed, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
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
