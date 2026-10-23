-- 033_message_template_image.sql
-- Added 2026-10-23 (PRD section 24): one preview photo per message level, stored on
-- the level's message_templates row. The share page /s/<tag> shows it on the
-- WhatsApp link card.
-- HITL: the owner runs `npm run migrate` BEFORE the code that saves a photo is
-- pushed. Reading is safe without it (no photo is simply shown), but saving a photo
-- writes the column and would fail until it exists.

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS image_url text;
