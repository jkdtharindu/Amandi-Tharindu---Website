import { NextRequest, NextResponse } from 'next/server';

const csrfCookieName = 'csrf_token';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const existing = request.cookies.get(csrfCookieName)?.value;
  if (existing && existing.length >= 64) {
    return NextResponse.json({ token: existing });
  }

  const buffer = new Uint8Array(48);
  crypto.getRandomValues(buffer);
  const token = Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');

  const response = NextResponse.json({ token });
  response.cookies.set(csrfCookieName, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}
