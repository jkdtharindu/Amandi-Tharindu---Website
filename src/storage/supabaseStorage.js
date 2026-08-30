import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Slice 13/14 (image uploads). One bucket, folder-prefixed per the PRD's Storage
// requirement -- see docs/amandi-tharindu-wedding-PRD.md and TASKS.md Slice 13.
export const BUCKET_NAME = 'wedding-media';
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_FOLDERS = ['hero', 'invitations', 'venues', 'story', 'gallery'];

const EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

let cachedClient = null;

export function isStorageConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Server-side only -- the service role key bypasses RLS, which is how a
 * single admin-authenticated Express route can write without giving the
 * bucket public write access. Never send this key to a browser.
 */
function getClient() {
  if (!cachedClient) {
    cachedClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return cachedClient;
}

/**
 * Creates the shared bucket if it doesn't exist yet. Idempotent -- safe to
 * call from a one-off setup script (`npm run setup-storage`) or a boot hook.
 * Supabase enforces the size/type limits passed here on every future upload,
 * so they hold even for uploads made outside this codebase.
 */
export async function ensureBucketExists() {
  if (!isStorageConfigured()) {
    const error = new Error('Supabase Storage is not configured.');
    error.code = 'storage_not_configured';
    throw error;
  }

  const supabase = getClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  if ((buckets || []).some((bucket) => bucket.name === BUCKET_NAME)) {
    return { created: false };
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
  if (createError) throw createError;
  return { created: true };
}

/**
 * Uploads a validated image buffer and returns its public URL. Callers
 * (the /api/admin/upload route) are expected to validate size/type/folder
 * before calling this -- it trusts its inputs and only handles the upload.
 */
export async function uploadImage({ buffer, mimeType, folder }) {
  if (!isStorageConfigured()) {
    const error = new Error('Supabase Storage is not configured.');
    error.code = 'storage_not_configured';
    throw error;
  }

  const extension = EXTENSION_BY_MIME_TYPE[mimeType];
  const key = `${folder}/${randomUUID()}${extension}`;

  const supabase = getClient();
  const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(key, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) {
    const error = new Error('Upload to Supabase Storage failed.');
    error.code = 'upload_failed';
    error.cause = uploadError;
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(key);
  return { url: data.publicUrl, key };
}
