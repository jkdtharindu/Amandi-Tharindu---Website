/**
 * Invitation code generation (PRD §23, Action 84).
 *
 * Format: `[GROUP LETTER][NAME LETTER][3 DIGITS]`, e.g. `FN482`.
 * - 1st letter of the group (Friends -> F)
 * - 1st letter of the guest, family or couple name (Nimal Silva -> N)
 * - 3 random digits
 *
 * Two groups or names that share a letter share a prefix; the digits keep each
 * code unique. That leaves 1000 codes per letter pair.
 */

/** First letter A-Z of `text`, upper-cased, or '' when it has none. */
function firstLetter(text) {
  const match = String(text ?? '').match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : '';
}

/**
 * Returns a unique code for `name` and `relationship` (the group), skipping any
 * code already in `existingCodes` (compared case-insensitively).
 */
export function generateGuestCode(name, relationship, existingCodes = []) {
  const nameLetter = firstLetter(name);
  if (!nameLetter) throw new Error('invalid_name');

  const groupLetter = firstLetter(relationship);
  if (!groupLetter) throw new Error('invalid_relationship');

  const prefix = `${groupLetter}${nameLetter}`;
  const taken = new Set(existingCodes.map((code) => String(code).trim().toUpperCase()));

  const free = [];
  for (let n = 0; n < 1000; n += 1) {
    const candidate = `${prefix}${String(n).padStart(3, '0')}`;
    if (!taken.has(candidate)) free.push(candidate);
  }
  if (free.length === 0) throw new Error('code_space_exhausted');

  return free[Math.floor(Math.random() * free.length)];
}
