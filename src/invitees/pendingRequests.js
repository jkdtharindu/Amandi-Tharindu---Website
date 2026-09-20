/**
 * The approval list: guest-requested people still waiting, each joined to the
 * party that asked so the admin can see who is asking.
 *
 * A request whose guest has been removed (or no longer exists) is left out. The
 * admin removed that guest on purpose, so their request is not something to
 * approve, and approving it would add a headcount to a removed party
 * (Next Action 58).
 *
 * @param {{ id: string, name: string, createdAt: string, guestId: string }[]} pending
 * @param {{ id: string, name: string, code: string, isDeleted?: boolean }[]} guests every guest, removed ones included
 */
export function buildPendingRequests(pending, guests) {
  const guestById = new Map(guests.map((guest) => [guest.id, guest]));

  return pending.flatMap((invitee) => {
    const guest = guestById.get(invitee.guestId);
    if (!guest || guest.isDeleted) return [];
    return [
      {
        id: invitee.id,
        name: invitee.name,
        createdAt: invitee.createdAt,
        guestId: invitee.guestId,
        guestName: guest.name,
        guestCode: guest.code,
      },
    ];
  });
}
