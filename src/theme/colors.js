const DARK_INK = '#2B2118';
const LIGHT_INK = '#FFFFFF';

function channelLuminance(value) {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hexColor) {
  const hex = String(hexColor || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return 1;

  const r = channelLuminance(parseInt(hex.slice(0, 2), 16));
  const g = channelLuminance(parseInt(hex.slice(2, 4), 16));
  const b = channelLuminance(parseInt(hex.slice(4, 6), 16));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Picks whichever of dark/light ink reads more clearly on the given background,
 * so an admin-chosen colour can never produce unreadable button text.
 */
export function readableTextColor(backgroundColor) {
  return contrastRatio(DARK_INK, backgroundColor) >= contrastRatio(LIGHT_INK, backgroundColor)
    ? DARK_INK
    : LIGHT_INK;
}
