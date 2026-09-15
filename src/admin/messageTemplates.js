/**
 * RSVP reminder messages, sent as a WhatsApp deep link (PRD P1 messaging, slim slice).
 *
 * Sending goes through `https://wa.me/<phone>?text=<message>`, which opens
 * WhatsApp with the message pre-filled — the admin still presses Send inside
 * WhatsApp. Nothing is sent programmatically, so this needs no Twilio account,
 * costs nothing per message, and doesn't trigger the HITL gate on paid sends.
 */

export const DEFAULT_RSVP_REMINDER_TEMPLATE =
  "Hi {name}, we'd love to hear if you can make it! Please RSVP at {link} using your code: {code}";

const MIN_PHONE_DIGITS = 8;
const KNOWN_PLACEHOLDERS = ['name', 'link', 'code', 'date', 'venue'];

/**
 * Replaces placeholders with values from `data` (missing values become '').
 *
 * Both syntaxes are supported: `{name}` (used by the 2026-09-03 reminder
 * slice) and `[Name]` (the PRD spelling, used by the templates seeded in
 * migration 005). Matching is case-insensitive, and any other {word}/[Word]
 * is left untouched, so a typo like {linkk} shows up in the preview instead
 * of silently vanishing.
 *
 * Substitution is single-pass so a value that itself contains a placeholder
 * (a guest literally named "[Name]") is never re-expanded.
 */
export function renderTemplate(template, data = {}) {
  return String(template ?? '').replace(
    /\{(\w+)\}|\[(\w+)\]/g,
    (match, curlyKey, squareKey) => {
      const key = String(curlyKey ?? squareKey).toLowerCase();
      return KNOWN_PLACEHOLDERS.includes(key) ? String(data[key] ?? '') : match;
    }
  );
}

/**
 * Builds the site link used in outbound guest messages.
 *
 * Deliberately just the bare site root, not `/invitation/{code}` — the
 * invitation code is the *only* login credential the site has (there's no
 * separate password), so a clickable link with the code baked in lets
 * anyone who receives a forwarded message sign in as that guest with a
 * single tap. Every template that needs the code shows it as separate
 * plain text via the `{code}`/`[Code]` placeholder instead, matching how a
 * guest would read it off a printed invitation card (Action 37, 2026-09-15).
 */
export function buildSiteLink(siteUrl) {
  return String(siteUrl ?? '').replace(/\/+$/, '');
}

/** Builds a wa.me deep link that opens WhatsApp with `message` pre-filled. */
export function buildWhatsAppLink(phoneNumber, message) {
  const digits = String(phoneNumber ?? '').replace(/\D/g, '');
  if (digits.length < MIN_PHONE_DIGITS) {
    throw new Error('invalid_phone_number');
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
