/**
 * The hero background's curated set (PRD §18, TASKS.md Action 65) — a small,
 * code-defined list the admin can pick from instead of uploading their own
 * photo. Chosen scope (owner decision, 2026-09-29): a fixed list in code, not
 * an admin-managed gallery.
 *
 * Placeholders, not real photos: this session has no way to source or verify
 * real stock photography (no image-generation tool, no network access to a
 * stock photo host), so each entry is a small inline SVG gradient in the
 * site's own palette, encoded as a data: URI. A data URI needs no upload, no
 * external host, and works in `.hero-panel--photo`'s existing
 * `background-image: var(--hero-image-url)` exactly like a real photo would.
 *
 * To swap in real photos later: replace `dataUri` with a real image URL
 * (Vercel Blob or any hosted image) and `dominantColor` with that photo's
 * actual computed color (see src/storage/dominantColor.js) — no other code
 * changes needed, since the rest of the app treats every hero background the
 * same way regardless of where it came from.
 */

function gradientDataUri(fromHex, toHex) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${fromHex}'/>` +
    `<stop offset='1' stop-color='${toHex}'/>` +
    `</linearGradient></defs>` +
    `<rect width='1600' height='900' fill='url(%23g)'/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}`;
}

function averageHex(fromHex, toHex) {
  const channel = (hex, index) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const toHexPair = (value) => value.toString(16).padStart(2, '0');
  const mixed = [0, 1, 2].map((i) => Math.round((channel(fromHex, i) + channel(toHex, i)) / 2));
  return `#${mixed.map(toHexPair).join('')}`;
}

function preset(id, label, fromHex, toHex) {
  return {
    id,
    label,
    dataUri: gradientDataUri(fromHex, toHex),
    dominantColor: averageHex(fromHex, toHex),
  };
}

export const CURATED_BACKGROUNDS = [
  preset('placeholder-burgundy', 'Placeholder — Burgundy Wash', '#4A1525', '#7c2d40'),
  preset('placeholder-gold', 'Placeholder — Golden Hour', '#866D3D', '#d8b878'),
  preset('placeholder-dusk', 'Placeholder — Evening Dusk', '#2B2118', '#4A1525'),
];

export function findCuratedBackground(id) {
  return CURATED_BACKGROUNDS.find((entry) => entry.id === id) ?? null;
}
