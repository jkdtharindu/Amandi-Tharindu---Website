-- 020_add_party_assignment.sql
-- Added 2026-09-20: Multi-admin support (P1-14B, P1-14D)
-- Add party assignment field to guests table

ALTER TABLE guests
ADD COLUMN assigned_to_party text NOT NULL DEFAULT 'bride';

-- Create unique constraint: one family code per party
ALTER TABLE guests
DROP CONSTRAINT IF EXISTS guests_code_key;

ALTER TABLE guests
ADD CONSTRAINT guests_code_party_unique UNIQUE (code, assigned_to_party);

-- Create index for party-filtered queries
CREATE INDEX IF NOT EXISTS idx_guests_party ON guests(assigned_to_party);
CREATE INDEX IF NOT EXISTS idx_guests_party_status ON guests(assigned_to_party, rsvp_status);
