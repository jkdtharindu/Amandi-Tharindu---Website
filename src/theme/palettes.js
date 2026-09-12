/**
 * Curated ThemePalette and FontChoice options — PRD §4.1. Selecting one of
 * these writes primaryColor/secondaryColor/accentColor (or fontFamily/
 * fontStyle) in one step, replacing free-form hex/font-name entry as the
 * primary path. Values must clear WCAG AA — see tests/theme-palettes.test.mjs.
 *
 * `inkColor` doubles as each palette's baseTextColor. `invertedTextColor`
 * (for text on a primaryColor-ish dark surface) and `surfaceColor` (a neutral
 * card background, distinct from the secondaryColor page tint) are white for
 * every palette — verified to clear WCAG AA against every palette's
 * primaryColor/inkColor, and matching the pre-existing hardcoded white cards
 * site-wide, so introducing them doesn't shift any palette's look.
 */
export const THEME_PALETTES = [
  {
    id: 'chateau-green',
    name: 'Chateau Green',
    primaryColor: '#2F4F3E',
    secondaryColor: '#F2F0E6',
    accentColor: '#A67C52',
    inkColor: '#1F2A22',
    invertedTextColor: '#FFFFFF',
    surfaceColor: '#FFFFFF',
  },
  {
    id: 'imperial-gold',
    name: 'Imperial Gold',
    primaryColor: '#8A6508',
    secondaryColor: '#FFF8DC',
    accentColor: '#7A1F1F',
    inkColor: '#2B2118',
    invertedTextColor: '#FFFFFF',
    surfaceColor: '#FFFFFF',
  },
  {
    id: 'rose-blush',
    name: 'Rose Blush',
    primaryColor: '#8C4A5A',
    secondaryColor: '#FBF1F0',
    accentColor: '#B08D57',
    inkColor: '#2E2024',
    invertedTextColor: '#FFFFFF',
    surfaceColor: '#FFFFFF',
  },
  {
    id: 'midnight-silver',
    name: 'Midnight Silver',
    primaryColor: '#2C3A4A',
    secondaryColor: '#F1F3F5',
    accentColor: '#8A94A6',
    inkColor: '#1C242E',
    invertedTextColor: '#FFFFFF',
    surfaceColor: '#FFFFFF',
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    primaryColor: '#9C4A21',
    secondaryColor: '#FBF2EA',
    accentColor: '#5F7A6B',
    inkColor: '#2E1F17',
    invertedTextColor: '#FFFFFF',
    surfaceColor: '#FFFFFF',
  },
  {
    id: 'modern-royal-romance',
    name: 'Modern Royal Romance',
    primaryColor: '#4A1525',
    secondaryColor: '#FBF9F5',
    accentColor: '#866D3D',
    inkColor: '#4A1525',
    invertedTextColor: '#FFFFFF',
    surfaceColor: '#FFFFFF',
  },
];

/**
 * Font pairings — PRD §4.1. Each ships a display face (headings) and a body
 * face (paired, currently always Inter). Webfonts are not yet self-hosted
 * (PRD §4.1 item 4), so any non-system face falls back to Georgia until that
 * ships — the picker is still useful for choosing which face to load later.
 */
export const FONT_CHOICES = [
  { id: 'cormorant', name: 'Cormorant', displayFont: 'Cormorant Garamond', fontStyle: 'italic' },
  { id: 'playfair', name: 'Playfair', displayFont: 'Playfair Display', fontStyle: 'normal' },
  { id: 'cinzel', name: 'Cinzel', displayFont: 'Cinzel', fontStyle: 'normal' },
  { id: 'inter', name: 'Inter', displayFont: 'Inter', fontStyle: 'normal' },
];

export function findPalette(paletteId) {
  return THEME_PALETTES.find((p) => p.id === paletteId) || null;
}

export function findFontChoice(fontChoiceId) {
  return FONT_CHOICES.find((f) => f.id === fontChoiceId) || null;
}
