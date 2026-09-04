import { NextRequest, NextResponse } from 'next/server';
import { listSections, createSection } from '@/src/sections/sectionsRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** All custom content sections, optionally filtered by page (P1-11). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const page = request.nextUrl.searchParams.get('page') || undefined;
  const sections = await listSections(page);
  return NextResponse.json({ success: true, sections });
}

/** Creates a custom content section for a public page (P1-11). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const result = await createSection(body);
  if (!result.success) {
    const errors = 'errors' in result ? result.errors : undefined;
    return NextResponse.json(
      { success: false, reason: 'validation_failed', message: 'Please correct the highlighted fields.', errors },
      { status: 400 }
    );
  }
  return NextResponse.json(result, { status: 201 });
}
