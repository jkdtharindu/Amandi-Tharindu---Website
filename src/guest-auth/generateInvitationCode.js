/**
 * InvitationCode generation.
 *
 * A code is printed on a physical wedding card and is the guest's login
 * credential, so it is fixed the moment cards go to print. Until then the
 * format is configurable.
 *
 * The default takes the FIRST name token, because Sinhalese names commonly
 * place the ancestral/ge name first — taking the last word there would build
 * the code from the given name and make it unrecognisable on the card.
 * Set surnamePosition to 'last' for names written the other way round.
 *
 * Changing a setting only affects codes generated afterwards — an existing
 * guest keeps the code that may already be on their card.
 */

/** Where in the guest's name to look for the token used as the code prefix. */
export const SURNAME_POSITIONS = ['first', 'last'];

/** Single-letter code prefix per RelationshipType, when groupPrefix is on. */
export const GROUP_PREFIX_LETTERS = {
  Relations: 'R',
  Colleagues: 'C',
  Neighbours: 'N',
  Friends: 'F',
};

export const CODE_FORMAT_DEFAULTS = { surnamePosition: 'first', groupPrefix: false };

/** Codes must survive being read off a printed card and typed on a phone. */
const MANUAL_CODE_PATTERN = /^[A-Z0-9-]{1,40}$/;

/** Strips anything that cannot appear in a code, and upper-cases the rest. */
function toCodeToken(word) {
  return String(word).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Extracts the name token used as the code prefix.
 *
 * `position` is 'first' (default) or 'last'. Falls back to GUEST so a nameless
 * or symbol-only entry cannot produce a bare "-001".
 */
export function extractSurname(name, position = CODE_FORMAT_DEFAULTS.surnamePosition) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GUEST';

  const chosen = position === 'first' ? parts[0] : parts[parts.length - 1];
  return toCodeToken(chosen) || 'GUEST';
}

/**
 * Builds the prefix a code's running number is appended to, e.g. `SILVA-` or
 * `R-SILVA-`. An unrecognised relationship simply drops the group letter rather
 * than emitting something like `UNDEFINED-`.
 */
function buildPrefix(name, { surnamePosition, groupPrefix, relationship }) {
  const surname = extractSurname(name, surnamePosition);
  const letter = groupPrefix ? GROUP_PREFIX_LETTERS[relationship] : null;
  return letter ? `${letter}-${surname}-` : `${surname}-`;
}

/**
 * Generates the next unused code for a guest.
 *
 * Numbering runs per prefix, so each surname (and each group, when the group
 * prefix is on) has its own sequence. The result is checked against the full
 * existing list, so switching format mid-list can never re-issue a code that is
 * already on someone's card.
 */
export function generateInvitationCode(name, existingCodes = [], options = {}) {
  const settings = { ...CODE_FORMAT_DEFAULTS, ...options };
  const prefix = buildPrefix(name, settings);

  const taken = new Set((existingCodes || []).map((code) => String(code).toUpperCase()));

  const numbers = [...taken]
    .filter((code) => code.startsWith(prefix))
    // Only the running number may follow the prefix; this keeps `SILVA-` from
    // matching `R-SILVA-001`-style codes and inflating the plain sequence.
    .map((code) => code.slice(prefix.length))
    .filter((suffix) => /^\d+$/.test(suffix))
    .map((suffix) => Number.parseInt(suffix, 10));

  let next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  let candidate = `${prefix}${String(next).padStart(3, '0')}`;
  while (taken.has(candidate)) {
    next += 1;
    candidate = `${prefix}${String(next).padStart(3, '0')}`;
  }

  return candidate;
}

/**
 * Validates an admin-supplied code. The escape hatch for any name the automatic
 * rule gets wrong — which, given the variety of Sri Lankan naming conventions,
 * will happen.
 */
export function validateManualCode(input) {
  const code = String(input ?? '').trim().toUpperCase();

  if (!code) return { success: false, reason: 'code_required' };
  if (!MANUAL_CODE_PATTERN.test(code)) return { success: false, reason: 'invalid_code_format' };

  return { success: true, code };
}

/** Validates the two format settings coming from the admin form. */
export function validateCodeFormatSettings(patch = {}) {
  const settings = { ...CODE_FORMAT_DEFAULTS };

  if (patch.surnamePosition !== undefined) {
    const position = String(patch.surnamePosition).trim();
    if (!SURNAME_POSITIONS.includes(position)) {
      return { success: false, reason: 'invalid_surname_position' };
    }
    settings.surnamePosition = position;
  }

  if (patch.groupPrefix !== undefined) {
    // An unchecked HTML checkbox posts nothing and a checked one posts 'on',
    // so accept the form shapes as well as a real boolean.
    const raw = patch.groupPrefix;
    settings.groupPrefix = raw === true || raw === 'on' || raw === 'true' || raw === '1';
  }

  return { success: true, settings };
}
