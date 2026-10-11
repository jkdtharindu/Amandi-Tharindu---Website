/**
 * The colour behind the section panels' tint (PRD §22, Action 80).
 *
 * The hero photo's stored average colour is usually a dark brown (candlelit
 * halls, dark carpet), which looks muddy on light panels. So it is never used
 * on its own: it is blended with the admin's Accent colour (owner's Grill Me
 * answer, 2026-10-11 -- "blend of photo and your palette"), and the CSS then
 * fades the result to a gentle wash over the Surface colour.
 *
 * Pure and DB-free so it runs on the server (building the CSS variable) and
 * in tests.
 */

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

// How much of the photo colour goes into the blend. The rest is Accent, so a
// theme always stays recognisably "its palette" whatever photo is chosen.
const HERO_SHARE = 0.4;

export const DEFAULT_GLASS_ENABLED = true;
export const DEFAULT_GLASS_STRENGTH = 60;

function parseHex(value) {
  const match = HEX_COLOR_PATTERN.exec(String(value ?? '').trim());
  if (!match) return null;
  const hex = match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function toHex(channels) {
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * Returns "#RRGGBB". With a usable hero colour: 40% photo + 60% Accent. With
 * none (no hero photo yet): the Accent alone. With neither valid: the
 * Secondary colour, and failing that a neutral warm grey, so the page can
 * never render with an undefined tint.
 */
export function computeSectionTint(heroDominantColor, accentColor, secondaryColor) {
  const hero = parseHex(heroDominantColor);
  const accent = parseHex(accentColor);

  if (hero && accent) {
    return toHex(
      hero.map((channel, i) => Math.round(channel * HERO_SHARE + accent[i] * (1 - HERO_SHARE)))
    );
  }
  if (accent) return toHex(accent);
  if (hero) return toHex(hero);
  const secondary = parseHex(secondaryColor);
  return secondary ? toHex(secondary) : '#B8A99A';
}

/** Coerces whatever is stored to a whole number 0-100; junk falls back to the default. */
export function normaliseGlassStrength(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_GLASS_STRENGTH;
  return Math.min(100, Math.max(0, Math.round(number)));
}

/** Inline-style variables + the on/off flag the root layout puts on <html>. */
export function buildSectionGlassVars(settings) {
  const enabled = settings.sectionGlassEnabled !== false;
  return {
    enabled,
    vars: {
      '--section-tint': computeSectionTint(
        settings.heroDominantColor,
        settings.accentColor,
        settings.secondaryColor
      ),
      '--glass-strength': String(normaliseGlassStrength(settings.sectionGlassStrength)),
    },
  };
}
