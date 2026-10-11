import sharp from 'sharp';

/**
 * A handful of representative colours from an image (PRD §22, Action 80
 * round 2). The single average colour in dominantColor.js is a muddy brown for
 * a candlelit hall; sections need the photo's actual colours (gold, wine,
 * blush, ivory). This reads a small copy of the picture, groups similar
 * pixels, and keeps the groups that are both common and colourful, skipping
 * near-black shadows and near-white glare.
 *
 * Throws on an unreadable image: callers decide what failure means (the upload
 * still succeeds with no palette, the sections fall back to the Accent tint).
 */

const SAMPLE_SIZE = 48;
const LEVELS = 8; // buckets per channel -> 512 groups
const MIN_DISTANCE = 60; // swatches closer than this (RGB distance) count as the same colour
const RELAXED_DISTANCE = 34;

const toHex = (channel) => Math.round(channel).toString(16).padStart(2, '0');

function saturationOf(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export async function extractPalette(buffer, count = 5) {
  const { data } = await sharp(buffer)
    // 'fill' squashes the whole picture into the sample (a wide photo's left and
    // right edges still count); 'nearest' avoids blending neighbouring colours
    // into muddy in-between ones.
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'fill', kernel: 'nearest' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const step = 256 / LEVELS;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.floor(r / step)}-${Math.floor(g / step)}-${Math.floor(b / step)}`;
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  const candidates = [];
  for (const bucket of buckets.values()) {
    const rgb = [bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n];
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    if (max < 45) continue; // near-black shadow
    if (min > 232) continue; // near-white glare
    const score = bucket.n * (0.25 + saturationOf(...rgb));
    candidates.push({ rgb, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  const picked = [];
  for (const minGap of [MIN_DISTANCE, RELAXED_DISTANCE]) {
    for (const candidate of candidates) {
      if (picked.length >= count) break;
      if (picked.some((p) => distance(p.rgb, candidate.rgb) < minGap)) continue;
      picked.push(candidate);
    }
    if (picked.length >= Math.min(count, 3)) break;
  }

  return picked.map(({ rgb }) => `#${rgb.map(toHex).join('').toUpperCase()}`);
}
