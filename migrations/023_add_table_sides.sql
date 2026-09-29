-- 023_add_table_sides.sql
-- Added 2026-09-28: Table sides and Common tables (PRD §20, P1-14I, TASKS.md Action 68).
-- A table's side is bride, groom or common; table names are unique ignoring capital letters,
-- and tables with no name are exempt. HITL: the owner runs `npm run migrate` from their own
-- terminal, and the code that depends on this is pushed only after it has run.
-- If the unique index fails because two test tables share a name, rename or delete one first.

ALTER TABLE seating_tables
  ADD CONSTRAINT seating_tables_side_check CHECK (assigned_to_party IN ('bride', 'groom', 'common'));

CREATE UNIQUE INDEX IF NOT EXISTS seating_tables_name_unique
  ON seating_tables (lower(table_name)) WHERE table_name IS NOT NULL;
