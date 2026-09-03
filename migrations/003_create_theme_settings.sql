-- 003_create_theme_settings.sql

CREATE TABLE IF NOT EXISTS theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_color text NOT NULL DEFAULT '#B8860B',
  secondary_color text NOT NULL DEFAULT '#FFF8DC',
  accent_color text NOT NULL DEFAULT '#8B0000',
  font_family text NOT NULL DEFAULT 'Cormorant Garamond',
  font_style text NOT NULL DEFAULT 'italic',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Single-row table: seed the one row here so app code never has to decide
-- between INSERT and UPDATE (see src/admin/themeRepo.js).
INSERT INTO theme_settings DEFAULT VALUES;
