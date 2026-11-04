import { NextRequest, NextResponse } from 'next/server';
import {
  getHomeSectionVisibility,
  getHomePartVisibility,
  getHomeSectionOrder,
  setHomeSectionVisibility,
  setHomePartVisibility,
  setHomeSectionOrder,
} from '@/src/home-sections/homeSectionsRepo.js';
import { revalidateAllPublicPages } from '@/src/revalidatePublicPages.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Which homepage sections and parts are shown, and the section order. */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const visibility = await getHomeSectionVisibility();
  const parts = await getHomePartVisibility();
  const order = await getHomeSectionOrder();
  return NextResponse.json({ success: true, visibility, parts, order });
}

/**
 * Three kinds of change:
 *  - { key: 'gallery', isVisible }          shows or hides one section
 *  - { key: 'our-story:milestones', isVisible }  shows or hides one part of a section
 *  - { order: ['gallery', 'our-story', ...] }    saves the section order (every section once)
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  let body: { key?: unknown; isVisible?: unknown; order?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  let result;
  let failure = 'That section cannot be changed.';
  try {
    if (body.order !== undefined) {
      result = await setHomeSectionOrder(body.order);
      failure = 'That order is not valid.';
    } else {
      const key = String(body.key ?? '');
      result = key.includes(':')
        ? await setHomePartVisibility(key, body.isVisible as boolean)
        : await setHomeSectionVisibility(key, body.isVisible as boolean);
    }
  } catch (error) {
    // Most likely migration 038 has not been run yet (saving the order needs it).
    console.error('Saving homepage section settings failed:', error);
    return NextResponse.json(
      { success: false, message: 'Could not save that change. Please try again.' },
      { status: 500 }
    );
  }
  if (!result.success) {
    return NextResponse.json(
      { success: false, reason: result.reason, message: failure },
      { status: 400 }
    );
  }

  revalidateAllPublicPages();
  return NextResponse.json({ success: true });
}
