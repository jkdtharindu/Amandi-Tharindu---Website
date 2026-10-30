-- 034_invitee_answered_by.sql
-- Added 2026-10-31: remembers WHICH DEVICE last saved each person's RSVP answer, as a
-- one-way hash of the network address (never the address itself). When a different
-- device later changes a saved answer, the invitation page asks "are you sure you want
-- to change <name>'s answer?" before saving it.
-- HITL: the owner runs `npm run migrate` BEFORE the code that saves answers is pushed,
-- because every save now writes this column.

ALTER TABLE invitees
  ADD COLUMN IF NOT EXISTS answered_by text;
