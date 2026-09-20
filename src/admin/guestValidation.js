/**
 * Validation for admin-entered guest details (PRD P0-07).
 *
 * Returns every field error at once so the admin form can highlight all
 * problems in a single pass rather than one per submit.
 */

import { getCategories } from './categories.js';
import { validateInviteeNames } from '../invitees/validateInvitees.js';

/** The relationship groups the admin can choose from (customizable via GUEST_CATEGORIES env var). */
export function getRelationships() {
  return getCategories();
}

const MIN_SLOT_COUNT = 1;
const MAX_SLOT_COUNT = 99;

/**
 * `inviteeNames`, when provided, names each person in a multi-person party
 * up front. The headcount is then derived from that list -- slotCount is
 * overwritten with inviteeNames.length rather than trusted from the form, so
 * the two can never disagree. Omitting inviteeNames keeps today's
 * headcount-only invitation (a single free-text RSVP for the whole party).
 *
 * `requirePeople` is for creating a guest. Every seat must belong to a named
 * person, or the party never appears in Table Arrangement's picker: a party of
 * two or more with no names is refused, and a party of one is saved as one
 * person carrying the guest's own name. Editing leaves it off, because guests
 * created before this rule are still headcount-only.
 */
export function validateGuestInput(input = {}, { requirePeople = false } = {}) {
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

  let inviteeNames;
  const namesGiven = Array.isArray(input.inviteeNames) && input.inviteeNames.length > 0;
  if (input.inviteeNames !== undefined && (namesGiven || !requirePeople)) {
    const namesResult = validateInviteeNames(input.inviteeNames);
    if (!namesResult.valid) {
      errors.inviteeNames = namesResult.error;
    } else {
      inviteeNames = namesResult.names;
    }
  }

  if (requirePeople && !inviteeNames && !errors.inviteeNames) {
    const headcount = Number(input.slotCount);
    if (headcount === 1) {
      if (name) inviteeNames = [name];
    } else {
      errors.inviteeNames = 'Add the name of each person in this party.';
    }
  }

  let slotCount;
  if (inviteeNames) {
    slotCount = inviteeNames.length;
  } else {
    slotCount = Number(input.slotCount);
    if (
      !Number.isInteger(slotCount) ||
      slotCount < MIN_SLOT_COUNT ||
      slotCount > MAX_SLOT_COUNT
    ) {
      errors.slotCount = `Slot count must be a whole number between ${MIN_SLOT_COUNT} and ${MAX_SLOT_COUNT}.`;
    }
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
      ...(inviteeNames ? { inviteeNames } : {}),
    },
  };
}
