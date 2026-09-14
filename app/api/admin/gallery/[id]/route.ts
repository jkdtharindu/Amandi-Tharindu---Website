import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';
import { verifyCsrfToken } from '@/src/csrf';
import { updateGalleryPhoto, deleteGalleryPhoto } from '@/src/gallery/galleryPhotosRepo.js';
import { sanitizeGalleryPhoto } from '@/src/gallery/validateGalleryPhoto.js';
import { revalidateAllPublicPages } from '@/src/revalidatePublicPages.js';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, message: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body' },
      { status: 400 }
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized = sanitizeGalleryPhoto(body as any);

    // Build update payload with only the fields that were provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = {};
    if ('caption' in body) updatePayload.caption = sanitized.caption;
    if ('displayOrder' in body) updatePayload.displayOrder = sanitized.displayOrder;

    const photo = await updateGalleryPhoto(id, updatePayload);

    if (!photo) {
      return NextResponse.json(
        { success: false, message: 'Gallery photo not found' },
        { status: 404 }
      );
    }

    revalidateAllPublicPages();
    return NextResponse.json({ success: true, photo });
  } catch (error) {
    console.error('Failed to update gallery photo:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update gallery photo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, message: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  try {
    const deleted = await deleteGalleryPhoto(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Gallery photo not found' },
        { status: 404 }
      );
    }

    revalidateAllPublicPages();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete gallery photo:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete gallery photo' },
      { status: 500 }
    );
  }
}
