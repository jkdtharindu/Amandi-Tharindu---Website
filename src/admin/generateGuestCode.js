/**
 * Invitation code generation (PRD P0-07).
 *
 * Format: `[CATEGORY]-[FIRST_NAME]-[RANDOM]`, e.g. `NEI-RU-742`.
 * - 3 letters from relationship/category
 * - 2 letters from first name
 * - 3 random digits
 */

/** Derives the first name from a guest name, e.g. "Ruwan Jayasuriya" -> "Ruwan". */
function derivateFirstName(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);

  if (!words.length) {
    throw new Error('invalid_name');
  }

  return words[0].toUpperCase();
}

/** Derives category prefix from relationship, e.g. "Neighbours" -> "NEI". */
function deriveCategoryPrefix(relationship) {
  const cleaned = String(relationship ?? '')
    .trim()
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();

  if (!cleaned) {
    throw new Error('invalid_relationship');
  }

  return cleaned.slice(0, 3);
}

/**
 * Returns a unique code for `name` and `relationship`, skipping any code already in
 * `existingCodes` (compared case-insensitively).
 */
export function generateGuestCode(name, relationship, existingCodes = []) {
  const firstName = derivateFirstName(name);
  const categoryPrefix = deriveCategoryPrefix(relationship);
  const firstNamePrefix = firstName.slice(0, 2);

  const taken = new Set(
    existingCodes.map((code) => String(code).trim().toUpperCase())
  );

  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const randomDigits = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const candidate = `${categoryPrefix}-${firstNamePrefix}-${randomDigits}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('code_space_exhausted');
}
