-- 018_cascade_message_logs_guest_id.sql
-- Next Action 39 (2026-09-17): give message_logs.guest_id an ON DELETE rule.
--
-- Migration 005 declared it as a bare `REFERENCES guests(id)`, unlike every
-- other table that points at guests (rsvp_responses: CASCADE,
-- table_seats.guest_id: SET NULL). Dormant today — guest removal only ever
-- soft-deletes — but the first real hard delete (a "delete my data" request is
-- the obvious one) would fail with a foreign-key violation for any guest who
-- had ever been messaged.
--
-- CASCADE rather than SET NULL: guest_id is NOT NULL, and a message log with
-- no guest is not worth keeping anyway. Deleting a person's data should take
-- their message history with it.
--
-- The existing key was created unnamed, so its name is Postgres's default
-- (normally message_logs_guest_id_fkey). Rather than rely on that, the block
-- below finds whichever foreign key on message_logs.guest_id points at guests
-- and drops it by its real name. `DROP CONSTRAINT IF EXISTS <assumed name>`
-- would silently do nothing on a mismatch and leave the old, non-cascading key
-- in place next to the new one — still blocking deletes. The runner applies
-- the whole file in one transaction, so there is no moment without a key.
-- Safe to re-run: it drops and recreates the same constraint.

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'f'
      AND con.conrelid = 'message_logs'::regclass
      AND con.confrelid = 'guests'::regclass
      AND att.attname = 'guest_id'
  LOOP
    EXECUTE format('ALTER TABLE message_logs DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END
$$;

ALTER TABLE message_logs
  ADD CONSTRAINT message_logs_guest_id_fkey
  FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE;
