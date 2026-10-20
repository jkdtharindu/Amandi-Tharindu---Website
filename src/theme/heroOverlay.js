/**
 * The hero photo's dark overlay, adapted to the image's own color (PRD §18,
 * TASKS.md Action 65) so white hero text stays readable on any photo: a light
 * photo gets a darker overlay, a dark photo gets a lighter one, letting more
 * of the image show through.
 *
 * Pure and DB/network-free so it can run both server-side (building the CSS
 * variable) and in a test, without touching sharp or the database.
 */

// The overlay this project shipped with before Action 65 (a fixed 45% black)
// — used whenever there's no computed color, so an existing site with no
// hero photo, or one whose color hasn't been computed yet, renders exactly
// as it did before this feature existed.
export const DEFAULT_HERO_OVERLAY = 'rgba(0, 0, 0, 0.45)';

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

// Perceived-brightness weights (ITU-R BT.601), the same formula used for
// grayscale conversion -- a fast, well-understood proxy for "does this color
// read as light or dark," which is all the overlay needs to decide.
function relativeLuminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * `hexColor` is the image's average color (see src/storage/dominantColor.js),
 * a 6-digit hex string like "#a68b5c". Returns an `rgba(0, 0, 0, X)` string:
 * darker (higher opacity) for a light photo, lighter for a dark one, clamped
 * to a range that keeps text readable at one end and the photo visible at
 * the other. Any missing or malformed color falls back to the pre-Action-65
 * default rather than guessing.
 */
export function computeOverlayOpacity(hexColor) {
  const match = HEX_COLOR_PATTERN.exec(String(hexColor ?? '').trim());
  if (!match) return 0.45;

  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  const luminance = relativeLuminance(r, g, b);
  // luminance 0 (black) -> 0.25 opacity; luminance 1 (white) -> 0.60 opacity.
  const opacity = 0.25 + luminance * 0.35;
  return Math.round(opacity * 100) / 100;
}

export function computeOverlayFromColor(hexColor) {
  if (!HEX_COLOR_PATTERN.test(String(hexColor ?? '').trim())) return DEFAULT_HERO_OVERLAY;
  return `rgba(0, 0, 0, ${computeOverlayOpacity(hexColor)})`;
}

/** Clamps the strength slider to a whole number 0-100. Missing or junk means 100. */
export function normaliseOverlayStrength(value) {
  const n = Number(value);
  if (value === '' || value == null || !Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * The CSS value for the hero photo's dark layer. The admin's on/off switch
 * (Action 85) turns it off completely. The strength slider (Action 87) scales
 * the adaptive opacity: 100 (the default) keeps today's look, 50 is half as
 * dark, 0 is see-through. Strength is clamped to 0-100; a missing value means 100.
 */
export function heroOverlayValue(hexColor, enabled, strength = 100) {
  if (enabled === false) return 'transparent';
  const pct = Number.isFinite(Number(strength)) ? Math.min(100, Math.max(0, Number(strength))) : 100;
  if (pct === 100) return computeOverlayFromColor(hexColor);
  const opacity = Math.round(computeOverlayOpacity(hexColor) * (pct / 100) * 100) / 100;
  return `rgba(0, 0, 0, ${opacity})`;
}
