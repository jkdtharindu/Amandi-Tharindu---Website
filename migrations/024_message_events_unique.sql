-- 024_message_events_unique.sql
-- Added 2026-09-28: Action 73's per-guest message drop-down needs "tick as
-- sent" to be idempotent and toggleable, but message_events (migration 021)
-- has no unique constraint on (guest_id, event_name), so recordMessageEvent's
-- `ON CONFLICT DO NOTHING` has no conflict to target -- every call inserted a
-- new row instead of updating the existing one. Nothing has ever written
-- through it from a real UI, but defensively dedupe first in case anything
-- has: keep the most-complete, most-recent row per (guest_id, event_name).

DELETE FROM message_events me
USING message_events keep
WHERE me.guest_id = keep.guest_id
  AND me.event_name = keep.event_name
  AND me.id <> keep.id
  AND (
    me.is_completed < keep.is_completed
    OR (me.is_completed = keep.is_completed AND me.created_at < keep.created_at)
    OR (me.is_completed = keep.is_completed AND me.created_at = keep.created_at AND me.id < keep.id)
  );

ALTER TABLE message_events
ADD CONSTRAINT message_events_guest_event_unique UNIQUE (guest_id, event_name);
