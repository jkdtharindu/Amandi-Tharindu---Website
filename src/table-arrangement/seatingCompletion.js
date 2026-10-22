/**
 * How completely each party is seated, for the Guest list's Seating column.
 *
 * The people who need a seat are the party's approved, individually accepted
 * invitees (the same people Table Arrangement offers for seating). A person is
 * seated if they hold a seat, or if the whole party holds a whole-party seat.
 * A headcount-only party (no named people) counts as one unit: seated or not.
 *
 *   complete: everyone who needs a seat has one   (green)
 *   partial:  some do, some do not                (yellow)
 *   none:     nobody has one yet, or nobody has accepted yet (red)
 *   skip:     the party declined, nothing to seat (no colour)
 *
 * `tables` is the shape listSeatingTables / listSeatingTablesByParty return.
 *
 * @param {{ guests?: any[], invitees?: any[], tables?: any[] }} input
 * @returns {Map<string, { status: 'complete' | 'partial' | 'none' | 'skip', seated: number, total: number }>}
 */
export function computeSeatingCompletion({ guests = [], invitees = [], tables = [] }) {
  const seatedGuestIds = new Set();
  const seatedInviteeIds = new Set();
  for (const table of tables) {
    for (const seat of table.seats ?? []) {
      if (seat.guestId) seatedGuestIds.add(seat.guestId);
      if (seat.inviteeId) seatedInviteeIds.add(seat.inviteeId);
    }
  }

  const result = new Map();
  for (const guest of guests) {
    if (guest.isDeleted) continue;

    const people = invitees.filter(
      (invitee) => invitee.guestId === guest.id && invitee.approvalStatus === 'approved'
    );
    const wholePartySeated = seatedGuestIds.has(guest.id);

    // Named people: count the accepted ones. Headcount-only: the party is the unit.
    let total;
    let seated;
    if (people.length > 0) {
      const accepted = people.filter((person) => person.rsvpStatus === 'accepted');
      total = accepted.length;
      seated = wholePartySeated ? total : accepted.filter((person) => seatedInviteeIds.has(person.id)).length;
    } else if (guest.rsvpStatus === 'accepted') {
      total = 1;
      seated = wholePartySeated ? 1 : 0;
    } else {
      total = 0;
      seated = 0;
    }

    let status;
    if (guest.rsvpStatus === 'declined') status = 'skip';
    else if (total === 0 || seated === 0) status = 'none';
    else if (seated === total) status = 'complete';
    else status = 'partial';

    result.set(guest.id, { status, seated, total });
  }
  return result;
}
