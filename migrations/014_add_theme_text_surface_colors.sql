-- 014_add_theme_text_surface_colors.sql
-- Next Action 25: three new admin-editable colors -- Base Text Color,
-- Inverted Text Color, Surface Color -- alongside the existing
-- primary/secondary/accent. Defaults chosen to be visually unchanged on
-- deploy: base_text_color matches colors.js's existing DARK_INK constant,
-- inverted_text_color matches LIGHT_INK, surface_color matches today's
-- hardcoded card white.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS base_text_color text DEFAULT '#2B2118',
  ADD COLUMN IF NOT EXISTS inverted_text_color text DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS surface_color text DEFAULT '#FFFFFF';
