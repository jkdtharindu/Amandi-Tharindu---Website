/**
 * Invitation code generation (PRD P0-07).
 *
 * Format: `[SURNAME]-[3-digit-number]`, e.g. `SILVA-001`.
 * The surname is the last word of the guest's name that contains letters.
 */

const MAX_SEQUENCE = 999;

/** Derives the code prefix from a guest name, e.g. "Nimal Silva" -> "SILVA". */
export function deriveSurname(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);

  // Prefer the last word with letters, so "Nimal 123" still yields NIMAL.
  const surname = words[words.length - 1];
  if (!surname) {
    throw new Error('invalid_name');
  }

  return surname.toUpperCase();
}

/**
 * Returns the next free code for `name`, skipping any code already in
 * `existingCodes` (compared case-insensitively).
 */
export function generateGuestCode(name, existingCodes = []) {
  const surname = deriveSurname(name);

  const taken = new Set(
    existingCodes.map((code) => String(code).trim().toUpperCase())
  );

  for (let sequence = 1; sequence <= MAX_SEQUENCE; sequence += 1) {
    const candidate = `${surname}-${String(sequence).padStart(3, '0')}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('code_space_exhausted');
}
