import { listSeatingTables } from './tableArrangementRepo.js';
import { listApprovedInvitees } from '../invitees/inviteesRepo.js';
import { tableLabel, tableLabelWithNumber } from './tableSides.js';

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
 * were required (Action 68). `tableNumber` is now shown to the guest too, in
 * front of each of their own seated people (`people`). A table's side (bride,
 * groom or Common) is never part of what a guest sees.
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
      people: table.seats
        .filter(isOwn)
        .map((seat) => (seat.inviteeName ? firstName(seat.inviteeName) : seat.guestName))
        .filter(Boolean),
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
 * One line per person in the guest's party, for the invitation page:
 * "Kanthi  RSVP Confirmed - Table 1 (Diamond)", "Janitha  RSVP Pending".
 * The table shows only for a person who has confirmed and is seated. People the
 * admin has not approved (or rejected) are left out. A party with no named
 * people is one line under the guest's own name and answer.
 *
 * `invitees` is what listInviteesForGuest returns; `tables` is listSeatingTables().
 */
export function buildGuestPeopleLines(tables, { guest, invitees = [] }) {
  const tableOf = (match) => {
    const table = tables.find((candidate) => candidate.seats.some(match));
    return table ? tableLabelWithNumber(table) : null;
  };
  const line = (name, status, table) => ({
    name,
    status,
    table: status === 'accepted' ? table : null,
  });

  const approved = invitees.filter((person) => person.approvalStatus === 'approved');
  if (approved.length === 0) {
    return [line(guest.name, guest.rsvpStatus ?? 'pending', tableOf((seat) => seat.guestId === guest.id))];
  }
  return approved.map((person) =>
    line(person.name, person.rsvpStatus ?? 'pending', tableOf((seat) => seat.inviteeId === person.id))
  );
}

/**
 * The table each seated named person sits at: inviteeId -> { number, name }.
 * `name` is null for a table that has no name. A table's side is never included.
 * `tables` is the shape listSeatingTables returns.
 */
export function buildInviteeTables(tables) {
  const byInvitee = new Map();
  for (const table of tables) {
    for (const seat of table.seats) {
      if (!seat.inviteeId || byInvitee.has(seat.inviteeId)) continue;
      byInvitee.set(seat.inviteeId, { number: table.table_number, name: table.table_name || null });
    }
  }
  return byInvitee;
}

/**
 * Adds `table` to each invitee for the invitation form: their { number, name }
 * once they have confirmed AND are seated, otherwise null. Never throws -- a
 * seating hiccup only hides the table, so the RSVP form keeps working.
 *
 * @param {any[]} invitees what listInviteesForGuest returns
 * @returns {Promise<any[]>}
 */
export async function withInviteeTables(invitees) {
  let tableOf = new Map();
  try {
    tableOf = buildInviteeTables(await listSeatingTables());
  } catch (error) {
    console.error('listSeatingTables failed, hiding per-person tables:', error);
  }
  return invitees.map((person) => ({
    ...person,
    table: person.rsvpStatus === 'accepted' ? tableOf.get(person.id) ?? null : null,
  }));
}

export async function getGuestPeopleLines(guest, invitees) {
  return buildGuestPeopleLines(await listSeatingTables(), { guest, invitees });
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
    const label = tableLabelWithNumber(table);
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

/**
 * For each guest (party) id with named people seated, one line per seated
 * person: "Nimal – Rose", in table order. This is what the `[TableNumber]`
 * placeholder fills with when a party's members sit at different tables, so
 * each person is told their own. A whole-party seat has no person to name, so
 * a party seated only that way is left out and the caller falls back to
 * tableLabelsByGuest(). Shows the table's number and name, e.g. "Table 5 (Rose)".
 */
export function tableMemberLinesByGuest(tables) {
  const lines = new Map();
  for (const table of [...tables].sort((a, b) => a.table_number - b.table_number)) {
    const label = tableLabelWithNumber(table);
    for (const seat of table.seats) {
      if (!seat.inviteeId || !seat.inviteeGuestId) continue;
      const list = lines.get(seat.inviteeGuestId) ?? [];
      list.push(`${firstName(seat.inviteeName)} – ${label}`);
      lines.set(seat.inviteeGuestId, list);
    }
  }
  return new Map([...lines].map(([guestId, list]) => [guestId, list.join('\n')]));
}
