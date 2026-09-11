import { put } from '@vercel/blob';

// Admin-only image uploads for Sections and Event venue photos, backed by
// Vercel Blob (chosen over standing up Supabase Storage, which this project
// never actually configured -- see src/storage/supabaseStorage.js, unused).
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// The browser's Content-Type is client-supplied and trivially spoofed (this
// project already caught a renamed executable claiming image/png once, in
// the legacy prototype's upload route -- see TASKS.md Action 8). Checking
// the real file signature closes the same gap here.
function hasValidMagicBytes(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

export function isStorageConfigured() {
  return Boolean(process.env.IMAGE_BLOB_READ_WRITE_TOKEN);
}

/** Pure validation, no I/O -- unit-testable without a real Blob token. */
export function validateImageFile({ buffer, mimeType }) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, reason: 'invalid_type' };
  }
  if (!buffer || buffer.length === 0) {
    return { valid: false, reason: 'empty_file' };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: 'file_too_large' };
  }
  if (!hasValidMagicBytes(buffer, mimeType)) {
    return { valid: false, reason: 'content_mismatch' };
  }
  return { valid: true };
}

/** Uploads a validated image buffer and returns its public URL. Callers
 * (the /api/admin/upload route) are expected to call validateImageFile()
 * first -- this trusts its inputs and only handles the upload. */
export async function uploadImage({ buffer, mimeType, filename }) {
  if (!isStorageConfigured()) {
    const error = new Error('Vercel Blob storage is not configured.');
    error.code = 'storage_not_configured';
    throw error;
  }

  const extension = EXTENSION_BY_MIME_TYPE[mimeType] || '';
  const key = `uploads/${filename || 'image'}${extension}`;

  const blob = await put(key, buffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType: mimeType,
    token: process.env.IMAGE_BLOB_READ_WRITE_TOKEN,
  });

  return { url: blob.url };
}
