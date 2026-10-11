-- 028_event_notes_and_home_section_visibility.sql
-- Added 2026-10-11: TASKS.md Action 81 part B, slice 1.
--   1. Each celebration event can carry a parking note and a dress code.
--   2. The admin can hide or show each built-in homepage section (Our Story,
--      The couple, Wedding events, Gallery, FAQ, Wishes). One row per section;
--      a section with no row is shown, so this table starts empty.
-- HITL: the owner applies this (npm run migrate, or Neon's SQL Editor) BEFORE
-- the code that saves these fields is pushed. Reading is safe without it for
-- visibility (the code treats a read failure as "show everything"), but saving
-- an event writes the two new columns and would fail until they exist.

ALTER TABLE celebration_events
  ADD COLUMN IF NOT EXISTS parking_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dress_code text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS home_section_visibility (
  section_key text PRIMARY KEY,
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
