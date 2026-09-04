-- 003_create_admin_theme_sections.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_color text DEFAULT '#B8860B',
  secondary_color text DEFAULT '#FFF8DC',
  accent_color text DEFAULT '#8B0000',
  font_family text DEFAULT 'Cormorant Garamond',
  font_style text DEFAULT 'italic',
  hero_image_url text,
  invitation_template_url text,
  invitation_name_top text DEFAULT '45%',
  invitation_name_left text DEFAULT '50%',
  invitation_name_font_size text DEFAULT '2rem',
  invitation_name_color text DEFAULT '#5C3317',
  couple_names text DEFAULT 'Amandi & Tharindu',
  wedding_date date DEFAULT '2026-12-14',
  venue_name text,
  venue_address text
);

-- theme_settings is a single-row table; seed the default row if empty.
INSERT INTO theme_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM theme_settings);

CREATE TABLE IF NOT EXISTS site_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  section_type text NOT NULL,
  title text,
  content text,
  display_order integer DEFAULT 0,
  is_visible boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_site_sections_page ON site_sections(page);
