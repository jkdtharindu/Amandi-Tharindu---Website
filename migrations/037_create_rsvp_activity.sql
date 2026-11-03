-- 037_create_rsvp_activity.sql
-- Added 2026-11-03: a plain history of RSVP answers (who accepted or declined, and when)
-- for the admin dashboard's "Recent RSVP answers" card. Additive only. The name and side
-- are copied in so a line still reads correctly if the guest is edited later; deleting a
-- guest removes their lines.
-- HITL: the owner runs `npm run migrate` BEFORE the code that writes this table is pushed.
-- (A missing table never blocks an RSVP: the history is written after the answer is saved
-- and a failure is only logged.)

CREATE TABLE IF NOT EXISTS rsvp_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  guest_name text NOT NULL,
  party text NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_activity_party_created ON rsvp_activity(party, created_at DESC);
