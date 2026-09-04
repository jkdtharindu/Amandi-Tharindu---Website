const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Curated options for the simple colors+font admin form (`/admin/theme`).
 * Free-text font_family isn't safe there: the curated set is exactly what
 * `buildFontFaceCss()` (src/theme/fontFaces.js) self-hosts via
 * `public/fonts/`, so an arbitrary name would silently fail to render for
 * visitors. The richer `src/theme/mergeThemeUpdate.js` path (palette/font
 * pickers, not yet wired to any admin UI) intentionally allows free-form
 * values instead — this module only guards the simple form.
 */
export const FONT_FAMILY_OPTIONS = [
  'Default',
  'Cormorant Garamond',
  'Playfair Display',
  'Cinzel',
];

export const FONT_STYLE_OPTIONS = ['italic', 'normal'];

export function validateThemeInput(input = {}) {
  const errors = {};

  const primaryColor = String(input.primaryColor ?? '').trim();
  if (!HEX_COLOR.test(primaryColor)) {
    errors.primaryColor = 'Primary color must be a hex value like #B8860B.';
  }

  const secondaryColor = String(input.secondaryColor ?? '').trim();
  if (!HEX_COLOR.test(secondaryColor)) {
    errors.secondaryColor = 'Secondary color must be a hex value like #FFF8DC.';
  }

  const accentColor = String(input.accentColor ?? '').trim();
  if (!HEX_COLOR.test(accentColor)) {
    errors.accentColor = 'Accent color must be a hex value like #8B0000.';
  }

  const fontFamily = String(input.fontFamily ?? '').trim();
  if (!FONT_FAMILY_OPTIONS.includes(fontFamily)) {
    errors.fontFamily = `Font family must be one of: ${FONT_FAMILY_OPTIONS.join(', ')}.`;
  }

  const fontStyle = String(input.fontStyle ?? '').trim();
  if (!FONT_STYLE_OPTIONS.includes(fontStyle)) {
    errors.fontStyle = `Font style must be one of: ${FONT_STYLE_OPTIONS.join(', ')}.`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    value: { primaryColor, secondaryColor, accentColor, fontFamily, fontStyle },
  };
}
