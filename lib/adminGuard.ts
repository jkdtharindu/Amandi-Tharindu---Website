import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '@/src/admin/adminSession.js';

export type AdminSession = { email: string; expiresAt: number };

/** Reads and verifies the admin session cookie, or returns null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE_NAME)?.value);
}

/** For server components: sends unauthenticated visitors to the login page. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin');
  return session;
}

/** For route handlers: the 401 body to return when there is no admin session. */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, reason: 'unauthorized', message: 'Admin login required.' },
    { status: 401 }
  );
}
