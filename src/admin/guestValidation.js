/**
 * Validation for admin-entered guest details (PRD P0-07).
 *
 * Returns every field error at once so the admin form can highlight all
 * problems in a single pass rather than one per submit.
 */

import { getCategories } from './categories.js';

/** The relationship groups the admin can choose from (customizable via GUEST_CATEGORIES env var). */
export function getRelationships() {
  return getCategories();
}

const MIN_SLOT_COUNT = 1;
const MAX_SLOT_COUNT = 99;

export function validateGuestInput(input = {}) {
  const errors = {};

  const name = String(input.name ?? '').trim();
  if (!name) {
    errors.name = 'Name is required.';
  }

  const relationship = String(input.relationship ?? '').trim();
  const validRelationships = getRelationships();
  if (!validRelationships.includes(relationship)) {
    errors.relationship = `Relationship must be one of: ${validRelationships.join(', ')}.`;
  }

  const slotCount = Number(input.slotCount);
  if (
    !Number.isInteger(slotCount) ||
    slotCount < MIN_SLOT_COUNT ||
    slotCount > MAX_SLOT_COUNT
  ) {
    errors.slotCount = `Slot count must be a whole number between ${MIN_SLOT_COUNT} and ${MAX_SLOT_COUNT}.`;
  }

  const rawWhatsapp = String(input.whatsappNumber ?? '').trim();

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    value: {
      name,
      relationship,
      slotCount,
      whatsappNumber: rawWhatsapp || null,
    },
  };
}
