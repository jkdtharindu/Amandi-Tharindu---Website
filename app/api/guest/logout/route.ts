import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfToken } from '@/src/csrf.js';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Every other state-changing route verifies CSRF; these two did not until
  // Next Action 36, which let a cross-site auto-submitting form sign a guest
  // out. No data is touched either way, so this is consistency more than
  // exposure — but an unexplained sign-out mid-RSVP is its own small harm.
  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('guest_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
