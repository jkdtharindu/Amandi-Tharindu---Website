export const VALID_RELATIONSHIP_TYPES = ['Relations', 'Colleagues', 'Neighbours', 'Friends'];

export function validateGuestInput(input, { partial = false } = {}) {
  const errors = [];
  const name = input?.name !== undefined ? String(input.name).trim() : undefined;
  const relationship = input?.relationship !== undefined ? String(input.relationship).trim() : undefined;
  const slotCountRaw = input?.slotCount;

  if (!partial || name !== undefined) {
    if (!name) {
      errors.push({ field: 'name', reason: 'required' });
    }
  }

  if (!partial || relationship !== undefined) {
    if (!relationship || !VALID_RELATIONSHIP_TYPES.includes(relationship)) {
      errors.push({ field: 'relationship', reason: 'invalid_relationship' });
    }
  }

  if (!partial || slotCountRaw !== undefined) {
    const slotCount = Number(slotCountRaw);
    if (!Number.isInteger(slotCount) || slotCount < 1) {
      errors.push({ field: 'slotCount', reason: 'invalid_slot_count' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const guest = {};
  if (name !== undefined) guest.name = name;
  if (relationship !== undefined) guest.relationship = relationship;
  if (slotCountRaw !== undefined) guest.slotCount = Number(slotCountRaw);

  return { success: true, guest };
}
