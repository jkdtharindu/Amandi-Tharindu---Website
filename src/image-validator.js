/**
 * Image file validation by magic bytes (file signature), not just MIME type.
 * Prevents attacks where a malicious file is renamed with an image extension.
 */

const MAGIC_BYTES = {
  // JPEG: FF D8 FF
  'image/jpeg': [0xff, 0xd8, 0xff],
  // PNG: 89 50 4E 47
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  // WebP: RIFF ... WEBP
  'image/webp': null, // Variable signature, needs substring matching
};

/**
 * Validate image buffer against expected MIME type using magic bytes.
 * Returns { valid: boolean, reason?: string }
 */
export function validateImageBuffer(buffer, mimeType) {
  if (!buffer || buffer.length < 4) {
    return { valid: false, reason: 'File is too small' };
  }

  switch (mimeType) {
    case 'image/jpeg': {
      const header = [buffer[0], buffer[1], buffer[2]];
      if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
        return { valid: true };
      }
      return { valid: false, reason: 'Invalid JPEG signature' };
    }

    case 'image/png': {
      const header = [buffer[0], buffer[1], buffer[2], buffer[3]];
      if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
        return { valid: true };
      }
      return { valid: false, reason: 'Invalid PNG signature' };
    }

    case 'image/webp': {
      // WebP starts with "RIFF", has 4 bytes of size, then "WEBP"
      if (
        buffer[0] === 0x52 && // 'R'
        buffer[1] === 0x49 && // 'I'
        buffer[2] === 0x46 && // 'F'
        buffer[3] === 0x46 && // 'F'
        buffer.length >= 12 &&
        buffer[8] === 0x57 && // 'W'
        buffer[9] === 0x45 && // 'E'
        buffer[10] === 0x42 && // 'B'
        buffer[11] === 0x50 // 'P'
      ) {
        return { valid: true };
      }
      return { valid: false, reason: 'Invalid WebP signature' };
    }

    default:
      return { valid: false, reason: `Unsupported MIME type: ${mimeType}` };
  }
}

/**
 * Detect file type from magic bytes, returning the MIME type.
 * Useful for verifying that a file claiming one type isn't actually another.
 */
export function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // Check JPEG (FF D8 FF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // Check PNG (89 50 4E 47)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  // Check WebP (RIFF ... WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}
