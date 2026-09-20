-- 021_create_message_events.sql
-- Added 2026-09-20: Message event tracking for WhatsApp sends (P1-14G)
-- Tracks which message events have been completed (sent) for each guest

CREATE TABLE IF NOT EXISTS message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  -- event_name examples: "RSVP Reminder", "Thank You", "Table Details", "Final Reminder"
  sent_by_party text NOT NULL,
  -- sent_by_party: bride | groom
  sent_at timestamptz DEFAULT now(),
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_events_guest_id ON message_events(guest_id);
CREATE INDEX IF NOT EXISTS idx_message_events_party ON message_events(sent_by_party);
CREATE INDEX IF NOT EXISTS idx_message_events_completed ON message_events(is_completed);
