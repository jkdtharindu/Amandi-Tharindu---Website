export async function loginGuestByCode(code, guestStore) {
  const guest = guestStore.find(
    (entry) => entry.code === code && entry.isDeleted !== true
  );

  if (!guest) {
    return {
      success: false,
      reason: 'guest_not_found',
    };
  }

  return {
    success: true,
    guestId: guest.id,
    sessionId: guest.id,
  };
}
