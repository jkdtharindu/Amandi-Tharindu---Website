-- 011_add_image_url.sql
-- Adds an optional image URL to custom Sections and celebration Events, so
-- the admin panel can attach a photo to either (Vercel Blob storage --
-- see src/storage/blobStorage.js -- rather than the Supabase Storage the
-- project never actually set up).

ALTER TABLE site_sections ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE celebration_events ADD COLUMN IF NOT EXISTS image_url text;
