import 'dotenv/config';
import { ensureBucketExists, isStorageConfigured, BUCKET_NAME } from '../src/storage/supabaseStorage.js';

if (!isStorageConfigured()) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env before running this script.'
  );
  process.exit(1);
}

const { created } = await ensureBucketExists();
console.log(
  created
    ? `Created bucket "${BUCKET_NAME}" (public-read, 5MB limit, image/jpeg|png|webp only).`
    : `Bucket "${BUCKET_NAME}" already exists -- nothing to do.`
);
