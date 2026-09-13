-- 015_add_couple_profiles.sql
-- Phase 6: Bride & Groom homepage section (id="family-details"). Scoped via
-- a Grill Me session 2026-09-13 -- see docs/amandi-tharindu-wedding-PRD.md
-- §17. Additive only: six new nullable/defaulted columns on the existing
-- single-row theme_settings table, following the same pattern as migration
-- 014 (base/inverted text + surface color).

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS bride_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bride_photo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bride_bio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS groom_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS groom_photo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS groom_bio text DEFAULT '';
