/**
 * Same format/locale as the legacy prototype's formatWeddingDate (src/server.js)
 * — "Monday, 14 December 2026" — so wiring theme_settings.wedding_date into the
 * Next.js app doesn't change how the date reads anywhere it already appears.
 */
export function formatWeddingDate(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
