-- 008_fix_couple_name_order.sql
-- Applies the owner's 2026-08-30 decision on couple-name ordering:
-- "Tharindu & Amandi" is canonical everywhere.
--
-- Migration 003 seeded theme_settings.couple_names via its column DEFAULT,
-- which was 'Amandi & Tharindu' -- so the live row still holds the old
-- order even though src/data/themeStore.js's in-memory default was already
-- flipped (commit 8b96c8c). The four WhatsApp templates seeded by migration
-- 005 have the old order baked into their body text.
--
-- Only rows still holding the old text are touched, so an admin who has
-- since edited these values by hand is left alone.

ALTER TABLE theme_settings
  ALTER COLUMN couple_names SET DEFAULT 'Tharindu & Amandi';

UPDATE theme_settings
SET couple_names = 'Tharindu & Amandi'
WHERE couple_names = 'Amandi & Tharindu';

UPDATE message_templates
SET body = replace(body, 'Amandi & Tharindu', 'Tharindu & Amandi')
WHERE body LIKE '%Amandi & Tharindu%';
