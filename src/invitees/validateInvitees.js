/**
 * Validation for invitee name lists (admin creation) and single names
 * (a guest's own "add another person" request).
 */

const MAX_NAMES = 99;

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
  if (trimmed.length > 200) {
    return { valid: false, error: 'That name is too long.' };
  }
  return { valid: true, name: trimmed };
}
