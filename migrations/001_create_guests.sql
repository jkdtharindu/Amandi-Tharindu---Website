-- 001_create_guests.sql

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  relationship text NOT NULL,
  slot_count integer NOT NULL DEFAULT 1,
  whatsapp_number text,
  email text,
  has_visited boolean DEFAULT false,
  rsvp_status text DEFAULT 'pending', -- pending | accepted | declined
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_code ON guests(code);
CREATE INDEX IF NOT EXISTS idx_guests_rsvp_status ON guests(rsvp_status);
