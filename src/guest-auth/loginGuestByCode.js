import { findGuestByCode } from './guestRepo.js';

export async function loginGuestByCode(code, guestStore) {
  const guest = guestStore
    ? guestStore.find((entry) => entry.code === code && entry.isDeleted !== true)
    : await findGuestByCode(code);

  if (!guest) {
    return {
      success: false,
      reason: 'guest_not_found',
    };
  }

  return {
    success: true,
    type: 'exact',
    guestId: guest.id,
    sessionId: guest.id,
    code: guest.code,
  };
}
