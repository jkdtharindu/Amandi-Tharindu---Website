-- 034_add_invitee_dietary_notes.sql
-- An optional dietary note per person, asked on the RSVP form only after that
-- person picks Attending. Additive and nullable: existing rows and every
-- existing reader are untouched. HITL approval required before applying to the
-- live database. Apply this BEFORE deploying the code that writes the column.

ALTER TABLE invitees ADD COLUMN IF NOT EXISTS dietary_notes text;
