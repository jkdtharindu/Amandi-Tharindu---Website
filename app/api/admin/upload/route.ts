import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateImageFile, uploadImage, isStorageConfigured } from '@/src/storage/blobStorage.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Shared image upload endpoint for Sections and Event venue photos, backed
 * by Vercel Blob. See src/storage/blobStorage.js for validation/upload. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        success: false,
        reason: 'storage_not_configured',
        message: 'Image storage is not set up yet. Ask the site owner to enable Vercel Blob storage.',
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_form', message: 'Invalid upload request.' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, reason: 'no_file', message: 'No file was uploaded.' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateImageFile({ buffer, mimeType: file.type });
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, reason: validation.reason, message: 'That file could not be used. Please choose a JPEG, PNG, or WEBP image under 5MB.' },
      { status: 400 }
    );
  }

  try {
    const { url } = await uploadImage({ buffer, mimeType: file.type, filename: randomUUID() });
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('uploadImage failed:', error);
    return NextResponse.json(
      { success: false, reason: 'upload_failed', message: 'Upload failed. Please try again.' },
      { status: 502 }
    );
  }
}
