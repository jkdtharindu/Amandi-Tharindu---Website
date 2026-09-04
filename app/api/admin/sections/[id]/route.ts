import { NextRequest, NextResponse } from 'next/server';
import { updateSection, deleteSection } from '@/src/sections/sectionsRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json(
    { success: false, reason: 'section_not_found', message: 'That section no longer exists.' },
    { status: 404 }
  );

/** Edits a section's title/content/order/visibility (P1-11). */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const result = await updateSection(id, body);
  return result.success ? NextResponse.json(result) : notFound();
}

/** Removes a custom content section (P1-11). */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const result = await deleteSection(id);
  return result.success ? NextResponse.json(result) : notFound();
}
