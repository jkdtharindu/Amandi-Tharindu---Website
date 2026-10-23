import sharp from 'sharp';

// The size WhatsApp and most apps use for a large link-preview picture.
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

/**
 * Crops any uploaded photo to the link-card shape (1200x630, centred) and
 * returns a JPEG buffer. `rotate()` first so a phone photo's orientation flag is
 * honoured instead of producing a sideways crop.
 */
export async function cropShareImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85 })
    .toBuffer();
}
