-- 035_message_template_groups.sql
-- Added 2026-11-03: the Main invitation level can keep up to 4 wordings
-- (message_templates rows initial_invite, initial_invite_2 .. _4). Each row lists the
-- guest groups (guests.relationship) it is sent to; a group listed nowhere gets the
-- first wording.
-- Also: the invitation no longer carries the guest code (it goes in its own
-- "Guest code" message), so the seeded invitation wording loses "using your code: [Code]".
-- It only changes the row if the owner has not edited it.
-- HITL: the owner runs `npm run migrate` BEFORE the code that links groups is pushed.
-- Reading is safe without it (no groups are shown), but saving a link writes the column.

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS linked_groups text[] NOT NULL DEFAULT '{}';

UPDATE message_templates
   SET body = 'Dear [Name], you are cordially invited to the wedding of Tharindu & Amandi on [Date]. Please view your personal invitation and RSVP at [Link]. Your personal code will follow in a separate message. We look forward to celebrating with you! 💍'
 WHERE name = 'initial_invite'
   AND body = 'Dear [Name], you are cordially invited to the wedding of Tharindu & Amandi on [Date]. Please view your personal invitation and RSVP at [Link] using your code: [Code]. We look forward to celebrating with you! 💍';
