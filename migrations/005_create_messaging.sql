-- 005_create_messaging.sql
-- Message templates (pre-seeded) and message logs (sent to guests)

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  body text NOT NULL,
  channel text NOT NULL, -- whatsapp | sms | email
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id),
  template_id uuid REFERENCES message_templates(id),
  channel text NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- sent | failed | pending
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_guest_id ON message_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);

-- Pre-seed the 4 message templates
INSERT INTO message_templates (name, body, channel)
VALUES
  ('initial_invite', 'Dear [Name], you are cordially invited to the wedding of Amandi & Tharindu on [Date]. Please view your personal invitation and RSVP at [Link] using your code: [Code]. We look forward to celebrating with you! 💍', 'whatsapp'),
  ('reminder_1', 'Dear [Name], this is a gentle reminder to RSVP for Amandi & Tharindu''s wedding on [Date]. Your personal invitation: [Link] (Code: [Code]). We''d love to know if you can join us! 🎊', 'whatsapp'),
  ('reminder_2', 'Dear [Name], we''re finalising our guest list for our wedding on [Date]. Could you please confirm your attendance at [Link]? Thank you so much — Amandi & Tharindu 💛', 'whatsapp'),
  ('thank_you', 'Dear [Name], thank you so much for confirming your attendance! We can''t wait to celebrate with you on [Date] at [Venue]. With love, Amandi & Tharindu 💍🎊', 'whatsapp')
ON CONFLICT (name) DO NOTHING;
