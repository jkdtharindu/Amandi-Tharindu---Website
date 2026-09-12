-- 012_create_invitees.sql
-- Individual invitee RSVP & seating: a multi-person invitation can now name
-- each person and track their own accept/decline, instead of one status for
-- the whole party. Additive only -- existing guests never get a row here, so
-- their RSVP/seating behavior is untouched. HITL approval required before
-- applying to the live database.

CREATE TABLE IF NOT EXISTS invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  name text NOT NULL,
  rsvp_status text NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined')),
  added_by text NOT NULL DEFAULT 'admin' CHECK (added_by IN ('admin', 'guest')),
  approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending_approval', 'rejected')),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitees_guest_id ON invitees(guest_id);
CREATE INDEX IF NOT EXISTS idx_invitees_pending_approval ON invitees(approval_status) WHERE approval_status = 'pending_approval';

-- Third occupant type on table_seats, same additive pattern migration 010
-- used to add probable_attendee_id alongside guest_id.
ALTER TABLE table_seats
  ADD COLUMN IF NOT EXISTS invitee_id uuid REFERENCES invitees(id) ON DELETE SET NULL;

-- A seat holds at most one occupant: real Guest, ProbableAttendee, or an
-- individual Invitee, never more than one.
ALTER TABLE table_seats
  DROP CONSTRAINT IF EXISTS chk_seat_single_occupant;
ALTER TABLE table_seats
  ADD CONSTRAINT chk_seat_single_occupant
  CHECK (
    (CASE WHEN guest_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN probable_attendee_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN invitee_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
  );

-- Mirrors idx_table_seats_unique_guest / idx_table_seats_unique_probable_attendee:
-- an Invitee occupies at most one seat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_seats_unique_invitee
  ON table_seats(invitee_id)
  WHERE invitee_id IS NOT NULL;
