import { listSeatingTables } from './tableArrangementRepo.js';
import { listApprovedInvitees } from '../invitees/inviteesRepo.js';
import { tableLabel } from './tableSides.js';

/** "Nimal Perera" -> "Nimal". A party name on a whole-party seat is left whole. */
export function firstName(fullName) {
  return String(fullName ?? '').trim().split(/\s+/)[0] || '';
}

/**
 * What a guest sees about their seating: for each table where anyone in their
 * party sits, the table's label and the first names of the *other* people there.
 * Anonymous probable-attendance placeholders are left out.
 *
 * `label` is the table's name, or "Table N" for a table created before names
 * were required (Action 68). The number stays admin-facing: guests are shown
 * `label`, never `tableNumber`, which is kept only to order the lines. A table's
 * side (bride, groom or Common) is never part of what a guest sees.
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
      label: tableLabel(table),
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

/**
 * For each guest (party) id, the labels of the tables where anyone in that party
 * sits, in table-number order and without repeats — what the `[TableNumber]`
 * message placeholder fills with (PRD §20: the table's name, not its number).
 * A party seated at two tables gets both, joined by the caller.
 */
export function tableLabelsByGuest(tables) {
  const labels = new Map();
  for (const table of [...tables].sort((a, b) => a.table_number - b.table_number)) {
    const label = tableLabel(table);
    for (const seat of table.seats) {
      const guestId = seat.guestId || seat.inviteeGuestId;
      if (!guestId) continue;
      const list = labels.get(guestId) ?? [];
      if (!list.includes(label)) list.push(label);
      labels.set(guestId, list);
    }
  }
  return labels;
}
