import { MESSAGE_LEVELS } from './messageLevels.js';

// One WhatsApp preview picture serves every message link (/s/invitation, /s/code,
// /s/reminder, /s/table). It is stored on the Main invitation's message_templates
// row (image_url, migration 033), so no extra column is needed.
export const SHARE_IMAGE_LEVEL = MESSAGE_LEVELS[0];

/**
 * The picture every link card shows: the Main invitation row's, or - for a site that
 * uploaded per-level pictures before there was just one - the first level picture found.
 * @param {{ name: string, imageUrl?: string | null }[]} templates
 * @returns {string | null}
 */
export function shareImageUrl(templates = []) {
  const main = templates.find((entry) => entry.name === SHARE_IMAGE_LEVEL.templateName);
  if (main?.imageUrl) return main.imageUrl;
  for (const level of MESSAGE_LEVELS) {
    const found = templates.find((entry) => entry.name === level.templateName)?.imageUrl;
    if (found) return found;
  }
  return null;
}
