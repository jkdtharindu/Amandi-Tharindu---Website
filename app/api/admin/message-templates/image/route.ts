import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateImageFile, uploadImage, isStorageConfigured } from '@/src/storage/blobStorage.js';
import { cropShareImage } from '@/src/messaging/cropShareImage.js';
import { saveTemplateImage, listTemplates } from '@/src/messaging/messageTemplatesRepo.js';
import { SHARE_IMAGE_LEVEL } from '@/src/messaging/shareImage.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * The one WhatsApp preview photo every message link shows (PRD section 24). POST takes a
 * multipart form with `file`, crops the photo to 1200x630 and stores it; DELETE removes
 * it. Shared by both sides. It lives on the Main invitation's row; any picture an older
 * per-level upload left on another row is cleared so there is only ever one.
 */
function csrfFailure() {
  return NextResponse.json(
    { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
    { status: 403 }
  );
}

/** Clears every stored picture except `keepName`'s (older per-level uploads). */
async function clearOtherPictures(keepName: string | null) {
  const templates = (await listTemplates()) as { name: string; imageUrl?: string | null }[];
  for (const entry of templates) {
    if (entry.imageUrl && entry.name !== keepName) {
      await saveTemplateImage(entry.name, null, '');
    }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();
  if (!verifyCsrfToken(request)) return csrfFailure();

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { success: false, reason: 'storage_not_configured', message: 'Image storage is not set up yet. Ask the site owner to enable Vercel Blob storage.' },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid upload request.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'No file was uploaded.' }, { status: 400 });
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
    const cropped = await cropShareImage(buffer);
    const { url } = await uploadImage({ buffer: cropped, mimeType: 'image/jpeg', filename: `share-${randomUUID()}` });
    const template = await saveTemplateImage(SHARE_IMAGE_LEVEL.templateName, url, SHARE_IMAGE_LEVEL.defaultBody);
    await clearOtherPictures(SHARE_IMAGE_LEVEL.templateName);
    return NextResponse.json({ success: true, imageUrl: template?.imageUrl ?? url });
  } catch (error) {
    console.error('Failed to save message preview photo:', error);
    return NextResponse.json({ success: false, message: 'Could not save the photo. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();
  if (!verifyCsrfToken(request)) return csrfFailure();

  try {
    await clearOtherPictures(null);
    return NextResponse.json({ success: true, imageUrl: null });
  } catch (error) {
    console.error('Failed to remove message preview photo:', error);
    return NextResponse.json({ success: false, message: 'Could not remove the photo.' }, { status: 500 });
  }
}
