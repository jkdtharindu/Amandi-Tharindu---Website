/**
 * The confirm text for deleting a table (Action 61, finding 4). It says how many
 * people are seated there and that their dietary and notes entries are lost for
 * good, instead of a vague "seated guests will become unassigned".
 *
 * Only a non-Common table can be deleted while people sit at it; a Common table
 * must be empty first (the server answers 409), so it gets the short wording.
 *
 * @param {{ side?: string, seats?: { guestId?: string|null, inviteeId?: string|null, probableAttendeeId?: string|null, dietaryRequirements?: string|null, specialNotes?: string|null }[] }} table
 * @param {string} label the table's display name
 */
export function deleteTableWarning(table, label) {
  if (table.side === 'common') return `Delete the Common table "${label}"?`;

  const seats = Array.isArray(table.seats) ? table.seats : [];
  const seated = seats.filter((seat) => seat.guestId || seat.inviteeId || seat.probableAttendeeId);
  if (seated.length === 0) return `Delete "${label}"? It has no one seated.`;

  const withNotes = seated.filter((seat) => seat.dietaryRequirements || seat.specialNotes).length;
  const people = seated.length === 1 ? '1 person is' : `${seated.length} people are`;
  const notes =
    withNotes > 0
      ? ` The dietary and notes entries for ${withNotes === 1 ? '1 seat' : `${withNotes} seats`} will be lost for good.`
      : '';
  return `Delete "${label}"? ${people} seated here and will become unassigned.${notes}`;
}
