-- 009_create_celebration_events.sql
-- Admin Event Manager (P1-09): admin CRUD for celebration events (ceremony,
-- reception, etc.), each with its own venue -- distinct from
-- theme_settings.venue_name/venue_address, which describe a single global
-- venue and are unrelated to this per-event data.

CREATE TABLE IF NOT EXISTS celebration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date NOT NULL,
  event_time text NOT NULL,
  venue_name text NOT NULL,
  venue_address text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_celebration_events_display_order ON celebration_events(display_order);

-- Seed with the two events the-celebration page has hardcoded since launch,
-- so switching that page to read from this table doesn't blank it out.
INSERT INTO celebration_events (name, event_date, event_time, venue_name, display_order)
SELECT 'Ceremony', '2026-12-14', '3:00 PM', 'Sunrise Garden Hall', 0
WHERE NOT EXISTS (SELECT 1 FROM celebration_events);

INSERT INTO celebration_events (name, event_date, event_time, venue_name, display_order)
SELECT 'Reception', '2026-12-14', '6:00 PM', 'Moonlight Banquet Hall', 1
WHERE NOT EXISTS (SELECT 1 FROM celebration_events WHERE name = 'Reception');
