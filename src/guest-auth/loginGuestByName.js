export async function loginGuestByName(name, guestStore) {
  if (!name) {
    return { success: false, reason: 'missing_name' };
  }

  const needle = String(name).trim().toLowerCase();

  // Exact full-name match (case-insensitive)
  const exact = guestStore.find(
    (g) => String(g.name).toLowerCase() === needle && g.isDeleted !== true
  );

  if (exact) {
    return {
      success: true,
      guestId: exact.id,
      sessionId: exact.id,
    };
  }

  // Candidate search: substring match (case-insensitive)
  const candidates = guestStore
    .filter((g) => String(g.name).toLowerCase().includes(needle) && g.isDeleted !== true)
    .map((g) => ({ id: g.id, name: g.name, code: g.code }));

  return candidates;
}
