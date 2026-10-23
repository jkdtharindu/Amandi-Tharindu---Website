// Ready-made image prompt shown beside each level's preview photo upload (PRD
// section 24, decision 9). The admin copies it into any AI image tool, then uploads
// the picture it makes. The names, date and venue come from the site's own settings,
// so the prompt never goes stale; the headline line is fixed per level.
const HEADLINES = {
  main_invitation: 'You are invited to our wedding',
  rsvp_reminder: 'Please let us know if you can join us',
  table_update: 'Your table details are ready',
};

/**
 * @param {string} levelKey a key from MESSAGE_LEVELS
 * @param {{ coupleNames?: string, weddingDate?: string, venueName?: string }} details
 */
export function buildSharePhotoPrompt(levelKey, { coupleNames = '', weddingDate = '', venueName = '' } = {}) {
  const headline = HEADLINES[levelKey] ?? HEADLINES.main_invitation;
  const names = coupleNames.trim() || 'the couple';
  const lines = [
    `Design a wide landscape wedding link-preview card image, exactly 1200x630 pixels (1.91:1), for sharing in WhatsApp.`,
    `Style: elegant, warm and romantic. Soft ivory background, a thin gold border and delicate floral line art in the corners.`,
    `Text to show, large and easy to read even as a small thumbnail:`,
    `- Small line at the top: "${headline}"`,
    `- Main line in a graceful script font: "${names}"`,
  ];
  if (weddingDate.trim()) lines.push(`- Date line in a clean serif font: "${weddingDate.trim()}"`);
  if (venueName.trim()) lines.push(`- Small venue line: "${venueName.trim()}"`);
  lines.push(
    `Keep all text inside the centre 80% of the image so nothing is cut off when cropped. Use only the text above, spelled exactly as written.`,
    `No people, no logos, no QR codes, no tiny text. Strong contrast between text and background. Flat, print-quality design.`,
  );
  return lines.join('\n');
}
