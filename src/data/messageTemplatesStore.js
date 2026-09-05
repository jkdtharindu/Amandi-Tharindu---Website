/**
 * In-memory MessageTemplate store, used when DATABASE_URL is unset.
 *
 * Bodies mirror the four templates seeded by migration 005 *as amended by
 * migration 008* — which flipped the couple-name order to the canonical
 * "Tharindu & Amandi" — so the messaging center renders the same text with or
 * without a database. They use the PRD's [Name]/[Code]/[Link]/[Date]/[Venue]
 * placeholder spelling — see renderTemplate() in src/admin/messageTemplates.js.
 */
export const messageTemplates = [
  {
    id: 'template-initial-invite',
    name: 'initial_invite',
    body: 'Dear [Name], you are cordially invited to the wedding of Tharindu & Amandi on [Date]. Please view your personal invitation and RSVP at [Link] using your code: [Code]. We look forward to celebrating with you! 💍',
    channel: 'whatsapp',
  },
  {
    id: 'template-reminder-1',
    name: 'reminder_1',
    body: "Dear [Name], this is a gentle reminder to RSVP for Tharindu & Amandi's wedding on [Date]. Your personal invitation: [Link] (Code: [Code]). We'd love to know if you can join us! 🎊",
    channel: 'whatsapp',
  },
  {
    id: 'template-reminder-2',
    name: 'reminder_2',
    body: "Dear [Name], we're finalising our guest list for our wedding on [Date]. Could you please confirm your attendance at [Link]? Thank you so much — Tharindu & Amandi 💛",
    channel: 'whatsapp',
  },
  {
    id: 'template-thank-you',
    name: 'thank_you',
    body: "Dear [Name], thank you so much for confirming your attendance! We can't wait to celebrate with you on [Date] at [Venue]. With love, Tharindu & Amandi 💍🎊",
    channel: 'whatsapp',
  },
];
