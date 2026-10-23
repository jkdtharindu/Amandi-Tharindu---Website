import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateImageFile, uploadImage, isStorageConfigured } from '@/src/storage/blobStorage.js';
import { cropShareImage } from '@/src/messaging/cropShareImage.js';
import { saveTemplateImage } from '@/src/messaging/messageTemplatesRepo.js';
import { MESSAGE_LEVELS } from '@/src/messaging/messageLevels.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * The WhatsApp preview photo for one message level (PRD section 24). POST takes a
 * multipart form with `levelKey` and `file`, crops the photo to 1200x630 and
 * stores it; DELETE (JSON `{ levelKey }`) removes it. Shared by both sides, like
 * the level's wording.
 */
function csrfFailure() {
  return NextResponse.json(
    { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
    { status: 403 }
  );
}

function findLevel(key: unknown) {
  return MESSAGE_LEVELS.find((entry) => entry.key === key);
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

  const level = findLevel(formData.get('levelKey'));
  if (!level) {
    return NextResponse.json({ success: false, message: 'Unknown message level.' }, { status: 400 });
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
    const template = await saveTemplateImage(level.templateName, url, level.defaultBody);
    return NextResponse.json({ success: true, imageUrl: template?.imageUrl ?? url });
  } catch (error) {
    console.error('Failed to save message preview photo:', error);
    return NextResponse.json({ success: false, message: 'Could not save the photo. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();
  if (!verifyCsrfToken(request)) return csrfFailure();

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  const level = findLevel(body.levelKey);
  if (!level) {
    return NextResponse.json({ success: false, message: 'Unknown message level.' }, { status: 400 });
  }

  try {
    await saveTemplateImage(level.templateName, null, level.defaultBody);
    return NextResponse.json({ success: true, imageUrl: null });
  } catch (error) {
    console.error('Failed to remove message preview photo:', error);
    return NextResponse.json({ success: false, message: 'Could not remove the photo.' }, { status: 500 });
  }
}
