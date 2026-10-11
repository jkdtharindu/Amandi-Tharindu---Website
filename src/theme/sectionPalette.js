/**
 * Turns the hero photo's colours into one soft, readable wash per section
 * (PRD §22, Action 80 round 2). Pure and DB-free.
 *
 * The rule that keeps text readable: each wash starts as a mix of a photo
 * colour and the Surface colour, then is lightened step by step until the
 * Base text colour reads on it at CONTRAST_TARGET or better. A deep wine
 * swatch therefore becomes a pale rose wash, never a dark panel.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
const CONTRAST_TARGET = 8;
const SECTION_COUNT = 5;

export function parsePalette(value) {
  return String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => HEX.test(part))
    .map((part) => part.toUpperCase())
    .slice(0, 6);
}

/** "#A,#B" form for storing; '' if nothing valid. */
export function serialisePalette(list) {
  return parsePalette(Array.isArray(list) ? list.join(',') : list).join(',');
}

export function isValidPaletteString(value) {
  const text = String(value ?? '').trim();
  return text === '' || (text.split(',').every((part) => HEX.test(part.trim())) && text.split(',').length <= 6);
}

function channels(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function toHex(values) {
  return `#${values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** share = how much of `top` goes in (0-1). */
export function mixHex(top, bottom, share) {
  const a = channels(top);
  const b = channels(bottom);
  return toHex(a.map((c, i) => c * share + b[i] * (1 - share)));
}

function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function safeHex(value, fallback) {
  return HEX.test(String(value ?? '').trim()) ? String(value).trim().toUpperCase() : fallback;
}

/**
 * Five contrast-safe wash colours. `strength` (0-100) sets how colourful they
 * start: 0 is almost pure Surface, 100 is about 75% photo colour (before the
 * contrast check pulls dark swatches back).
 */
export function buildSectionColors(settings) {
  const surface = safeHex(settings.surfaceColor, '#FFFFFF');
  const text = safeHex(settings.baseTextColor, '#2B2118');
  const strength = Math.min(100, Math.max(0, Number(settings.sectionGlassStrength ?? 60) || 0));
  const startShare = 0.1 + (strength / 100) * 0.65;

  const swatches = parsePalette(settings.heroPalette);
  // Fallback when no palette has been read yet: the colours the theme itself has.
  const backups = [settings.accentColor, settings.primaryColor, settings.heroDominantColor, settings.secondaryColor]
    .map((c) => safeHex(c, ''))
    .filter(Boolean);
  const pool = swatches.length > 0 ? swatches : backups.length > 0 ? backups : ['#B8A99A'];

  return Array.from({ length: SECTION_COUNT }, (_, i) => {
    const swatch = pool[i % pool.length];
    let share = startShare;
    let wash = mixHex(swatch, surface, share);
    while (contrastRatio(wash, text) < CONTRAST_TARGET && share > 0.04) {
      share -= 0.04;
      wash = mixHex(swatch, surface, Math.max(share, 0));
    }
    return wash;
  });
}
