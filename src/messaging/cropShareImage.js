import sharp from 'sharp';

// The size WhatsApp and most apps use for a large link-preview picture.
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

// WhatsApp falls back to a small thumbnail when the preview picture is heavy
// (roughly over 300 KB), so stay safely under that.
export const SHARE_IMAGE_MAX_BYTES = 280 * 1024;

const TARGET_RATIO = SHARE_IMAGE_WIDTH / SHARE_IMAGE_HEIGHT;
const RATIO_TOLERANCE = 0.03;

/**
 * Makes any uploaded picture into a link-card JPEG: 1200x630, under
 * SHARE_IMAGE_MAX_BYTES. A picture already close to the card shape fills it. Any
 * other shape (for example a 3:2 AI image) is shown whole on top of a blurred copy
 * of itself, so designed text near the edges is never cut off. The orientation flag
 * is honoured first so a phone photo is not turned sideways.
 */
export async function cropShareImage(buffer) {
  const upright = await sharp(buffer).rotate().toBuffer();
  const { width = 1, height = 1 } = await sharp(upright).metadata();
  const closeToCard = Math.abs(width / height / TARGET_RATIO - 1) <= RATIO_TOLERANCE;

  let card = sharp(upright).resize(SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT, { fit: 'cover', position: 'centre' });
  if (!closeToCard) {
    const backdrop = await sharp(upright)
      .resize(SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT, { fit: 'cover', position: 'centre' })
      .blur(30)
      .toBuffer();
    const whole = await sharp(upright)
      .resize(SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT, { fit: 'inside' })
      .toBuffer();
    card = sharp(backdrop).composite([{ input: whole, gravity: 'centre' }]);
  }
  const flat = await card.toBuffer();

  let out = flat;
  for (const quality of [85, 75, 65, 55, 45]) {
    out = await sharp(flat).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length <= SHARE_IMAGE_MAX_BYTES) break;
  }
  return out;
}
