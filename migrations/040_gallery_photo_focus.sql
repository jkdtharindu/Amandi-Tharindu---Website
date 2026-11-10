-- 040_gallery_photo_focus.sql
-- Added 2026-11-10: each gallery photo can have a "focus point" (0-100 across,
-- 0-100 down) so the cropped thumbnail on the home page keeps the faces in view.
-- 50 / 50 = centre, which is how every photo looked before.
-- HITL: the owner runs `npm run migrate` BEFORE pushing the code. The code
-- saves the focus point in its own statement and reads rows with SELECT *, so
-- the gallery keeps working (centred) until this has been run.

ALTER TABLE gallery_photos
  ADD COLUMN IF NOT EXISTS focus_x integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS focus_y integer NOT NULL DEFAULT 50;
