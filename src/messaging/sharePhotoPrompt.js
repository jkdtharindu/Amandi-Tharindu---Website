// Ready-made image prompt shown beside each level's preview photo upload (PRD
// section 24, decision 9). The admin copies it into any AI image tool, then uploads
// the picture it makes. The names, date, venue and colours come from the site's own
// settings, so the prompt never goes stale and the card matches the website. The
// headline and the mood are fixed per level.
const LEVEL_STYLE = {
  main_invitation: {
    headline: 'You are invited to our wedding',
    mood: 'A joyful, celebratory feel, like the front of a wedding invitation card.',
  },
  rsvp_reminder: {
    headline: 'Please let us know if you can join us',
    mood: 'A friendly, gentle feel, like a warm personal note. Slightly lighter and simpler than an invitation.',
  },
  table_update: {
    headline: 'Your table details are ready',
    mood: 'A calm, tidy feel, like a welcome card at the entrance of the reception.',
  },
};

/**
 * @param {string} levelKey a key from MESSAGE_LEVELS
 * @param {{ coupleNames?: string, weddingDate?: string, venueName?: string,
 *   colors?: { name?: string, primary?: string, secondary?: string, accent?: string } }} details
 */
export function buildSharePhotoPrompt(levelKey, { coupleNames = '', weddingDate = '', venueName = '', colors = {} } = {}) {
  const style = LEVEL_STYLE[levelKey] ?? LEVEL_STYLE.main_invitation;
  const names = coupleNames.trim() || 'the couple';

  const lines = [
    `Create ONE wedding link-preview card image for sharing in WhatsApp.`,
    `Format: landscape, exactly 1200x630 pixels (1.91:1). Not square, not portrait. Output only the finished card, flat, with no phone or paper mock-up, no frame and no margin around it.`,
    `Style: elegant, warm and romantic, with delicate floral line art in the corners. ${style.mood}`,
  ];

  const palette = [
    colors.primary && `main colour ${colors.primary}`,
    colors.secondary && `second colour ${colors.secondary}`,
    colors.accent && `accent colour ${colors.accent}`,
  ].filter(Boolean);
  if (palette.length) {
    const label = colors.name ? ` ("${colors.name}")` : '';
    lines.push(`Colours (the wedding website palette${label}): ${palette.join(', ')}. Use these, with soft ivory or white where it helps the text stand out.`);
  } else {
    lines.push(`Colours: soft ivory background with gold accents.`);
  }

  lines.push(
    `Text to show, large and easy to read even as a small thumbnail:`,
    `- Small line at the top: "${style.headline}"`,
    `- Main line, the biggest text, in a graceful script font: "${names}"`,
  );
  if (weddingDate.trim()) lines.push(`- Date line in a clean serif font: "${weddingDate.trim()}"`);
  if (venueName.trim()) lines.push(`- Small venue line: "${venueName.trim()}"`);
  lines.push(
    `Use only the text above, spelled exactly as written. Keep all text inside the centre 80% of the image so nothing is cut off. Centre the text.`,
    `No people, no logos, no QR codes, no tiny text. Strong contrast between text and background.`,
  );
  return lines.join('\n');
}
