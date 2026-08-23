/** Extracts the uppercase surname token used as the invitation-code prefix. */
export function extractSurname(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GUEST';

  const surname = parts[parts.length - 1].toUpperCase().replace(/[^A-Z0-9]/g, '');
  return surname || 'GUEST';
}

/** Generates the next `[SURNAME]-[3-digit-number]` code for the given guest name. */
export function generateInvitationCode(name, existingCodes = []) {
  const surname = extractSurname(name);
  const prefix = `${surname}-`;
  const numbers = existingCodes
    .filter((code) => String(code).startsWith(prefix))
    .map((code) => Number.parseInt(String(code).slice(prefix.length), 10))
    .filter((value) => Number.isFinite(value));

  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${surname}-${String(next).padStart(3, '0')}`;
}
