/**
 * @font-face declarations for the curated FontChoice pairings (PRD §4.1),
 * self-hosted from `public/fonts/` and served by this app — no third-party
 * CDN request, so the site works even when Google Fonts is unreachable
 * from Sri Lanka. Files sourced from @fontsource (SIL OFL licensed) via
 * `scripts/copy-fonts.js`; weights match what buildStyles() actually uses
 * (400/500/600/700).
 */
const FACES = [
  { family: 'Cormorant Garamond', file: 'cormorant-garamond-latin-400-normal', weight: 400, style: 'normal' },
  { family: 'Cormorant Garamond', file: 'cormorant-garamond-latin-400-italic', weight: 400, style: 'italic' },
  { family: 'Cormorant Garamond', file: 'cormorant-garamond-latin-500-normal', weight: 500, style: 'normal' },
  { family: 'Cormorant Garamond', file: 'cormorant-garamond-latin-500-italic', weight: 500, style: 'italic' },
  { family: 'Cormorant Garamond', file: 'cormorant-garamond-latin-600-normal', weight: 600, style: 'normal' },
  { family: 'Cormorant Garamond', file: 'cormorant-garamond-latin-600-italic', weight: 600, style: 'italic' },
  { family: 'Cormorant Garamond', file: 'cormorant-garamond-latin-700-normal', weight: 700, style: 'normal' },
  { family: 'Cormorant Garamond', file: 'cormorant-garamond-latin-700-italic', weight: 700, style: 'italic' },
  { family: 'Playfair Display', file: 'playfair-display-latin-400-normal', weight: 400, style: 'normal' },
  { family: 'Playfair Display', file: 'playfair-display-latin-500-normal', weight: 500, style: 'normal' },
  { family: 'Playfair Display', file: 'playfair-display-latin-600-normal', weight: 600, style: 'normal' },
  { family: 'Playfair Display', file: 'playfair-display-latin-700-normal', weight: 700, style: 'normal' },
  { family: 'Cinzel', file: 'cinzel-latin-400-normal', weight: 400, style: 'normal' },
  { family: 'Cinzel', file: 'cinzel-latin-500-normal', weight: 500, style: 'normal' },
  { family: 'Cinzel', file: 'cinzel-latin-600-normal', weight: 600, style: 'normal' },
  { family: 'Cinzel', file: 'cinzel-latin-700-normal', weight: 700, style: 'normal' },
  { family: 'Inter', file: 'inter-latin-400-normal', weight: 400, style: 'normal' },
  { family: 'Inter', file: 'inter-latin-500-normal', weight: 500, style: 'normal' },
  { family: 'Inter', file: 'inter-latin-600-normal', weight: 600, style: 'normal' },
  { family: 'Inter', file: 'inter-latin-700-normal', weight: 700, style: 'normal' },
];

export function buildFontFaceCss() {
  return FACES.map(
    (f) => `
  @font-face {
    font-family: '${f.family}';
    font-style: ${f.style};
    font-weight: ${f.weight};
    font-display: swap;
    src: url('/fonts/${f.file}.woff2') format('woff2');
  }`
  ).join('');
}
