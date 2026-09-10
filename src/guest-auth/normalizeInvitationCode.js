/**
 * Guests type their code from a printed card, often in lower case or with a
 * stray space. Every generated and manual code is upper case (see
 * generateInvitationCode.js), so matching is done on the upper-cased form.
 */
export function normalizeInvitationCode(input) {
  return String(input ?? '').trim().toUpperCase();
}
