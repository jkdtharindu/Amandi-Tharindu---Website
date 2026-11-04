-- 039_event_end_time.sql
-- Added 2026-11-04: a celebration event can have an optional end time
-- ("3:00 PM - 6:00 PM" on the event cards). Stored as text like event_time,
-- in Sri Lanka time. Empty means "no end time shown".
-- HITL: the owner runs `npm run migrate` BEFORE pushing the code. The code
-- saves the end time in a separate step, so saving an event without an end
-- time keeps working even if this has not been run yet; only saving an end
-- time needs the column.

ALTER TABLE celebration_events
  ADD COLUMN IF NOT EXISTS end_time text NOT NULL DEFAULT '';
