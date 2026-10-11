import { NextRequest, NextResponse } from 'next/server';
import { getHomeSectionVisibility, setHomeSectionVisibility } from '@/src/home-sections/homeSectionsRepo.js';
import { revalidateAllPublicPages } from '@/src/revalidatePublicPages.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Which built-in homepage sections are shown, e.g. { gallery: false }. */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const visibility = await getHomeSectionVisibility();
  return NextResponse.json({ success: true, visibility });
}

/** Shows or hides one built-in homepage section: { key, isVisible }. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  let body: { key?: unknown; isVisible?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const result = await setHomeSectionVisibility(String(body.key ?? ''), body.isVisible as boolean);
  if (!result.success) {
    return NextResponse.json(
      { success: false, reason: result.reason, message: 'That section cannot be changed.' },
      { status: 400 }
    );
  }

  revalidateAllPublicPages();
  return NextResponse.json({ success: true });
}
