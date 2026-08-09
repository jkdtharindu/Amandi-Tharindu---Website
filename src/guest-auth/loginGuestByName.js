import { findGuestByName, findGuestCandidatesByName } from './guestRepo.js';

export async function loginGuestByName(name, guestStore) {
  if (!name || !String(name).trim()) {
    return { success: false, reason: 'missing_name' };
  }

  const needle = String(name).trim().toLowerCase();
  const exact = guestStore
    ? guestStore.find(
        (g) => String(g.name).toLowerCase() === needle && g.isDeleted !== true
      )
    : await findGuestByName(name);

  if (exact) {
    return {
      success: true,
      type: 'exact',
      guestId: exact.id,
      sessionId: exact.id,
      code: exact.code,
    };
  }

  const candidates = guestStore
    ? guestStore
        .filter(
          (g) =>
            String(g.name).toLowerCase().includes(needle) &&
            g.isDeleted !== true
        )
        .map((g) => ({ id: g.id, name: g.name, code: g.code }))
    : await findGuestCandidatesByName(name);

  if (candidates.length === 0) {
    return {
      success: false,
      reason: 'guest_not_found',
    };
  }

  return {
    success: false,
    type: 'candidates',
    candidates,
  };
}
