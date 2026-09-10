import { normalizeInvitationCode } from './normalizeInvitationCode.js';

/**
 * Decides whether an RSVP request may proceed. The guest comes from the signed
 * session, never from the request body: before 2026-09-10 `/api/guest/rsvp`
 * trusted the body's code, so anyone could overwrite any guest's RSVP, and its
 * 404-vs-200 answers could be used to test codes without hitting the login
 * rate limit.
 *
 * `sessionGuest` is the guest looked up from the session (null if signed out
 * or the guest was deleted); `requestedCode` is the optional code the client
 * sent, which must belong to that same guest if present.
 */
export function authorizeRsvp(sessionGuest, requestedCode) {
  if (!sessionGuest) {
    return { allowed: false, status: 401, reason: 'not_signed_in' };
  }
  if (requestedCode !== undefined && requestedCode !== null && requestedCode !== '') {
    if (normalizeInvitationCode(requestedCode) !== normalizeInvitationCode(sessionGuest.code)) {
      return { allowed: false, status: 403, reason: 'not_your_invitation' };
    }
  }
  return { allowed: true, guest: sessionGuest };
}
