-- 010_create_probable_attendees.sql
-- Anonymous seat-holder placeholders for the Table Arrangement Dashboard (P1-16).
-- See docs/amandi-tharindu-wedding-PRD.md §16. HITL approval required before applying.

CREATE TABLE IF NOT EXISTS probable_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_bucket text NOT NULL CHECK (rsvp_bucket IN ('declined', 'pending')),
  slot_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rsvp_bucket, slot_index)
);

ALTER TABLE table_seats
  ADD COLUMN IF NOT EXISTS probable_attendee_id uuid
    REFERENCES probable_attendees(id) ON DELETE SET NULL;

-- A seat holds at most one occupant, real Guest or ProbableAttendee, never both.
ALTER TABLE table_seats
  DROP CONSTRAINT IF EXISTS chk_seat_single_occupant;
ALTER TABLE table_seats
  ADD CONSTRAINT chk_seat_single_occupant
  CHECK (NOT (guest_id IS NOT NULL AND probable_attendee_id IS NOT NULL));

-- Mirrors idx_table_seats_unique_guest: a ProbableAttendee occupies at most one seat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_seats_unique_probable_attendee
  ON table_seats(probable_attendee_id)
  WHERE probable_attendee_id IS NOT NULL;
