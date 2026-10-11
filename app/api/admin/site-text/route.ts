import { NextRequest, NextResponse } from 'next/server';
import { getSiteTextOverrides, saveSiteText } from '@/src/site-text/siteTextRepo.js';
import { revalidateAllPublicPages } from '@/src/revalidatePublicPages.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** The wording the admin has changed, e.g. { 'hero.heading': 'Welcome!' }. */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const overrides = await getSiteTextOverrides();
  return NextResponse.json({ success: true, overrides });
}

/** Saves wording edits: { values: { key: text } }. Empty text goes back to the default. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  let body: { values?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const result = await saveSiteText(body.values as Record<string, string>);
  if (!result.success) {
    return NextResponse.json(
      { success: false, reason: 'validation_failed', message: 'Some wording could not be saved (too long or unknown).', errors: result.errors },
      { status: 400 }
    );
  }

  revalidateAllPublicPages();
  return NextResponse.json({ success: true });
}
