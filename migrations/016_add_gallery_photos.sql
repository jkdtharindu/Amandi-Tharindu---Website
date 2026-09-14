-- 016_add_gallery_photos.sql
-- Phase 6: Gallery photos (id="gallery" homepage section + /gallery fold).
-- Additive: creates a new gallery_photos table for admin-managed couple photos.
-- Backend: galleryPhotosRepo.js (CRUD). Admin UI: GalleryManager.tsx (upload/reorder/delete).
-- Public rendering: replaces hardcoded PLACEHOLDER_TILES on /gallery and the new
-- id="gallery" homepage section. Schema aligned with docs/WEDDING_DATABASE_SCHEMA.md
-- (ported from migration 002, which was written but never applied).

CREATE TABLE IF NOT EXISTS gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text NOT NULL,
  caption text DEFAULT '',
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_display_order
  ON gallery_photos(display_order);
