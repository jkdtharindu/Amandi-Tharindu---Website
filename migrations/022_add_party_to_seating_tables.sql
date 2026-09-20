-- 022_add_party_to_seating_tables.sql
-- Added 2026-09-20: Multi-admin support (P1-14H)
-- Add party assignment field to seating_tables table

ALTER TABLE seating_tables
ADD COLUMN assigned_to_party text NOT NULL DEFAULT 'bride';

-- Make (table_number, assigned_to_party) unique instead of just table_number
ALTER TABLE seating_tables
DROP CONSTRAINT IF EXISTS seating_tables_table_number_key;

ALTER TABLE seating_tables
ADD CONSTRAINT seating_tables_number_party_unique UNIQUE (table_number, assigned_to_party);

-- Create index for party-filtered queries
CREATE INDEX IF NOT EXISTS idx_seating_tables_party ON seating_tables(assigned_to_party);
