-- 041_create_hall_layout.sql
-- Added 2026-11-26: the visual hall layout on the Table Arrangement tab.
-- One new table only: it stores where each table and area is drawn. Nothing about
-- who sits where changes, and no existing table is altered.
-- HITL: the owner runs `npm run migrate` from their own terminal, and the code
-- that depends on this is pushed only after it has run.

CREATE TABLE IF NOT EXISTS hall_layout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shape text NOT NULL CHECK (shape IN ('table', 'rect', 'rounded', 'circle', 'heptagon', 'arrow')),
  seating_table_id uuid REFERENCES seating_tables(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  -- Centre of the item, in the hall drawing's own units (920 wide, 1300 high).
  x integer NOT NULL,
  y integer NOT NULL,
  width integer NOT NULL DEFAULT 100,
  height integer NOT NULL DEFAULT 100,
  rotation integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#94a3b8',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- A 'table' row is the position of one seating table; every other row is an area.
  CONSTRAINT hall_layout_table_link CHECK ((shape = 'table') = (seating_table_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS hall_layout_items_table_unique
  ON hall_layout_items (seating_table_id) WHERE seating_table_id IS NOT NULL;
