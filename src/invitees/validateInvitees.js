/**
 * Validation for invitee name lists (admin creation) and single names
 * (a guest's own "add another person" request).
 */

const MAX_NAMES = 99;
const MAX_NAME_LENGTH = 200;

/** Admin-supplied names when creating a multi-person invitation. */
export function validateInviteeNames(names) {
  if (!Array.isArray(names)) {
    return { valid: false, error: 'Invitee names must be a list.' };
  }

  const trimmed = names.map((name) => String(name ?? '').trim());
  if (trimmed.some((name) => !name)) {
    return { valid: false, error: 'Every invitee name must be filled in.' };
  }
  if (trimmed.length === 0) {
    return { valid: false, error: 'At least one invitee name is required.' };
  }
  if (trimmed.length > MAX_NAMES) {
    return { valid: false, error: `No more than ${MAX_NAMES} invitees are allowed.` };
  }

  return { valid: true, names: trimmed };
}

/** A guest requesting to add a single new person to their own invitation. */
export function validateRequestedInviteeName(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter a name.' };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { valid: false, error: 'That name is too long.' };
  }
  return { valid: true, name: trimmed };
}

/**
 * The legacy whole-party RSVP path, where a guest types their party's names as
 * free text rather than ticking admin-entered invitees.
 *
 * An empty list is fine here (a decline sends none, and a guest may accept
 * without naming anyone), which is why this is separate from
 * validateInviteeNames above — but the same ceilings apply. Until Next Action
 * 35 there were none at all, and any invitation code could post an array of
 * any size: codes are printed on cards and read aloud, so "holds a valid code"
 * is not a high bar.
 */
export function validateParticipantNames(names) {
  if (names === undefined || names === null) {
    return { valid: true, names: [] };
  }
  if (!Array.isArray(names)) {
    return { valid: false, error: 'Participant names must be a list.' };
  }
  if (names.length > MAX_NAMES) {
    return { valid: false, error: `No more than ${MAX_NAMES} names are allowed.` };
  }

  const trimmed = names.map((name) => String(name ?? '').trim()).filter(Boolean);
  if (trimmed.some((name) => name.length > MAX_NAME_LENGTH)) {
    return { valid: false, error: 'That name is too long.' };
  }

  return { valid: true, names: trimmed };
}
