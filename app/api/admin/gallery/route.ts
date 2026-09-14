import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';
import { verifyCsrfToken } from '@/src/csrf';
import { listGalleryPhotos, createGalleryPhoto } from '@/src/gallery/galleryPhotosRepo.js';
import { validateGalleryPhoto, sanitizeGalleryPhoto } from '@/src/gallery/validateGalleryPhoto.js';
import { revalidateAllPublicPages } from '@/src/revalidatePublicPages.js';

export async function GET() {
  if (!(await getAdminSession())) return unauthorizedResponse();

  try {
    const photos = await listGalleryPhotos();
    return NextResponse.json({ success: true, photos });
  } catch (error) {
    console.error('Failed to list gallery photos:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load gallery photos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(req)) {
    return NextResponse.json(
      { success: false, message: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const sanitized = sanitizeGalleryPhoto(body);
    const { valid, errors } = validateGalleryPhoto(sanitized);

    if (!valid) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors },
        { status: 400 }
      );
    }

    const photo = await createGalleryPhoto({
      photoUrl: sanitized.photoUrl,
      caption: sanitized.caption,
      displayOrder: sanitized.displayOrder,
    });

    revalidateAllPublicPages();
    return NextResponse.json({ success: true, photo }, { status: 201 });
  } catch (error) {
    console.error('Failed to create gallery photo:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create gallery photo' },
      { status: 500 }
    );
  }
}
