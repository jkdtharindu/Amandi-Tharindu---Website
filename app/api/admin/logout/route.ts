import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/src/admin/adminSession.js';

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
