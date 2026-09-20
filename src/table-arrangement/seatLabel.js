/**
 * The text shown for whoever sits on a seat.
 *
 * A seated invitee is shown as "Name (Party)", the same way the seat picker lists
 * them, so two people with the same first name from different families or groups
 * can be told apart on the chart. A whole-guest seat already carries the party's
 * own name, so it gets no brackets.
 *
 * @param {{ guestName?: string | null, inviteeName?: string | null, inviteeGuestName?: string | null, probableAttendeeLabel?: string | null }} seat
 * @returns {string | null}
 */
export function seatOccupantLabel(seat) {
  if (seat.guestName) return seat.guestName;
  if (seat.inviteeName) {
    const sameAsParty = !seat.inviteeGuestName || seat.inviteeGuestName === seat.inviteeName;
    return sameAsParty ? seat.inviteeName : `${seat.inviteeName} (${seat.inviteeGuestName})`;
  }
  return seat.probableAttendeeLabel ?? null;
}
