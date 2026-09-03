/**
 * RSVP reminder messages, sent as a WhatsApp deep link (PRD P1 messaging, slim slice).
 *
 * Sending goes through `https://wa.me/<phone>?text=<message>`, which opens
 * WhatsApp with the message pre-filled — the admin still presses Send inside
 * WhatsApp. Nothing is sent programmatically, so this needs no Twilio account,
 * costs nothing per message, and doesn't trigger the HITL gate on paid sends.
 */

export const DEFAULT_RSVP_REMINDER_TEMPLATE =
  "Hi {name}, we'd love to hear if you can make it! Please RSVP at {link}";

const MIN_PHONE_DIGITS = 8;
const KNOWN_PLACEHOLDERS = ['name', 'link', 'code'];

/**
 * Replaces {name}, {link}, {code} with values from `data` (missing values
 * become ''). Any other {word} is left untouched, so a typo like {linkk}
 * shows up in the preview instead of silently vanishing.
 */
export function renderTemplate(template, data = {}) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (match, key) =>
    KNOWN_PLACEHOLDERS.includes(key) ? String(data[key] ?? '') : match
  );
}

/** Builds the guest-facing invitation URL for a code. */
export function buildInvitationLink(siteUrl, code) {
  const base = String(siteUrl ?? '').replace(/\/+$/, '');
  return `${base}/invitation/${code}`;
}

/** Builds a wa.me deep link that opens WhatsApp with `message` pre-filled. */
export function buildWhatsAppLink(phoneNumber, message) {
  const digits = String(phoneNumber ?? '').replace(/\D/g, '');
  if (digits.length < MIN_PHONE_DIGITS) {
    throw new Error('invalid_phone_number');
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
