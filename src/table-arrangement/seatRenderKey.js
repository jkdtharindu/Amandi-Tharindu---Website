/**
 * The React key for a seat's card on the Table Arrangement screen.
 *
 * SeatCard keeps the seat's dietary and notes text in its own state, seeded once
 * from props. While the key was the seat id alone, that text outlived the person:
 * remove one person, seat another on the same seat, and the new person's box still
 * showed the previous person's dietary note, with a Save button that would store
 * it on them (Next Action 60). With the occupant in the key, React builds a fresh
 * card, and fresh state from the server's values, whenever the occupant changes —
 * and keeps the card, and any text being typed, while it does not.
 *
 * @param {{ id: string, guestId?: string | null, inviteeId?: string | null, probableAttendeeId?: string | null }} seat
 * @returns {string}
 */
export function seatRenderKey(seat) {
  if (seat.guestId) return `${seat.id}:guest:${seat.guestId}`;
  if (seat.inviteeId) return `${seat.id}:invitee:${seat.inviteeId}`;
  if (seat.probableAttendeeId) return `${seat.id}:probable:${seat.probableAttendeeId}`;
  return `${seat.id}:empty`;
}
