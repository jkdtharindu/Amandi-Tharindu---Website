-- 007_create_table_arrangements.sql
-- Table seating arrangements for the wedding event.

CREATE TABLE IF NOT EXISTS seating_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number integer NOT NULL UNIQUE,
  table_name text,
  capacity integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS table_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seating_table_id uuid NOT NULL REFERENCES seating_tables(id) ON DELETE CASCADE,
  seat_number integer NOT NULL,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  dietary_requirements text,
  special_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(seating_table_id, seat_number)
);

-- A guest occupies at most one seat. Partial so that the many empty seats
-- (guest_id IS NULL) do not collide with each other. This is what makes
-- concurrent seat assignment safe -- the repo relies on it rather than on a
-- read-then-write check.
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_seats_unique_guest
  ON table_seats(guest_id)
  WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seating_tables_number ON seating_tables(table_number);
