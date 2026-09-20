import { listSeatingTables } from './tableArrangementRepo.js';
import { listApprovedInvitees } from '../invitees/inviteesRepo.js';

/** "Nimal Perera" -> "Nimal". A party name on a whole-party seat is left whole. */
export function firstName(fullName) {
  return String(fullName ?? '').trim().split(/\s+/)[0] || '';
}

/**
 * What a guest sees about their seating: for each table where anyone in their
 * party sits, the table number and the first names of the *other* people there.
 * Anonymous probable-attendance placeholders are left out.
 *
 * `tables` is the shape listSeatingTables returns; `inviteeIds` are the guest's
 * own people, so their party is never listed back to them.
 */
export function buildGuestTableView(tables, { guestId, inviteeIds = [] }) {
  const ownPeople = new Set(inviteeIds);
  const isOwn = (seat) => seat.guestId === guestId || (seat.inviteeId && ownPeople.has(seat.inviteeId));

  return tables
    .filter((table) => table.seats.some(isOwn))
    .sort((a, b) => a.table_number - b.table_number)
    .map((table) => ({
      tableNumber: table.table_number,
      tableName: table.table_name || null,
      mates: table.seats
        .filter((seat) => !isOwn(seat))
        .map((seat) => (seat.inviteeName ? firstName(seat.inviteeName) : seat.guestName))
        .filter(Boolean),
    }));
}

export async function getGuestTableView(guestId) {
  const [tables, approved] = await Promise.all([listSeatingTables(), listApprovedInvitees(guestId)]);
  return buildGuestTableView(tables, { guestId, inviteeIds: approved.map((person) => person.id) });
}
