import sharp from 'sharp';

/**
 * The uploaded image's average color, as a 6-digit hex string (PRD §18,
 * TASKS.md Action 65). Resizing to a single pixel and reading it back is
 * `sharp`'s own documented way to get an image's average color -- a fast,
 * dependency-light stand-in for a full dominant-color/palette extraction
 * (no `node-vibrant` or similar needed), good enough for choosing whether
 * the hero overlay should be light or dark.
 *
 * Callers decide what a failure means: this throws rather than swallowing
 * errors, so an upload can still succeed with no computed color instead of
 * silently saving a wrong one.
 */
export async function computeDominantColor(buffer) {
  const { data } = await sharp(buffer)
    .resize(1, 1, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const [r, g, b] = data;
  const toHex = (channel) => channel.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
