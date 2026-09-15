-- 017_add_code_to_reminder_2.sql
-- Part of Action 37 (2026-09-15): outbound WhatsApp links no longer carry
-- the guest's invitation code (it is the site's only login credential, so a
-- clickable link with the code baked in let anyone with a forwarded message
-- sign in as that guest). Every template now needs to show [Code] as
-- separate plain text -- initial_invite and reminder_1 (migration 005)
-- already do; reminder_2 never did, so it would otherwise leave a guest
-- with no way to know their code once [Link] stops carrying it.
--
-- Only the row still holding the known seeded text is touched, so an admin
-- who has since edited this template by hand is left alone -- same guard
-- pattern as migration 008's message_templates fix.

UPDATE message_templates
SET body = replace(
  body,
  'confirm your attendance at [Link]?',
  'confirm your attendance at [Link]? Your code is [Code].'
)
WHERE name = 'reminder_2'
  AND body LIKE '%confirm your attendance at [Link]?%'
  AND body NOT LIKE '%[Code]%';
