-- 036_invitee_decline_request.sql
-- Added 2026-11-03: a guest cannot decline a person who already has a seat. They ask the
-- couple instead, and this column remembers that they did. When the admin then frees the
-- person's seat, the answer changes to "declined" by itself and the column is cleared.
-- HITL: the owner runs `npm run migrate` BEFORE the code that reads this column is pushed,
-- because the table arrangement page now selects it.

ALTER TABLE invitees
  ADD COLUMN IF NOT EXISTS decline_requested_at timestamptz;
