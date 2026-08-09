-- 002_create_rsvp_responses.sql

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid REFERENCES guests(id) ON DELETE CASCADE,
  attending boolean NOT NULL,
  participant_names text[],
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_guest_id ON rsvp_responses(guest_id);
