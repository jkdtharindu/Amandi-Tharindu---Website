-- 029_site_text.sql
-- Added 2026-10-11: TASKS.md Action 81 part B, slice 2 (editable wording).
-- One row per piece of guest-facing wording the admin has changed. A key with
-- no row uses the default wording that lives in code
-- (src/site-text/siteTextRegistry.js), so this table starts empty and the site
-- looks the same until the admin edits something.
-- HITL: the owner applies this (npm run migrate, or Neon's SQL Editor) BEFORE
-- the code that saves wording is pushed. Reading is safe without it (the
-- guest pages fall back to the default wording), but saving would fail.

CREATE TABLE IF NOT EXISTS site_text (
  text_key text PRIMARY KEY,
  text_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
