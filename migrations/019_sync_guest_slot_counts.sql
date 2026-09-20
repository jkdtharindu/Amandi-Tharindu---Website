-- 019_sync_guest_slot_counts.sql
-- Syncs all guests' slot_count to match their actual approved invitee counts.
-- This fixes any discrepancies from prior bugs where slotCount drifted from invitee count.

UPDATE guests
SET slot_count = (
  SELECT COUNT(*)::int
  FROM invitees
  WHERE guest_id = guests.id AND approval_status = 'approved'
)
WHERE EXISTS (
  SELECT 1 FROM invitees
  WHERE guest_id = guests.id AND approval_status = 'approved'
) AND is_deleted = false;
