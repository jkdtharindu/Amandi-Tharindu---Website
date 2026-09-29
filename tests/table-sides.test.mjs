import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createSeatingTable,
  updateSeatingTable,
  deleteSeatingTable,
  assignGuestToSeat,
  assignInviteeToSeat,
  assignProbableAttendeeToSeat,
  setProbableAttendeeBuffer,
  listUnassignedProbableAttendees,
  listSeatingTables,
  listSeatingTablesByParty,
  listUnassignedInviteesByParty,
  isUserFacingError,
  userFacingStatus,
} from '../src/table-arrangement/tableArrangementRepo.js';
import {
  validateNewTable,
  validateTableUpdate,
  resolveRequestedSide,
  buildLeftoverSummary,
  tableLabel,
} from '../src/table-arrangement/tableSides.js';
import { seatAssignmentRefusal, seatRemovalRefusal } from '../src/table-arrangement/seatingRules.js';
import { loadTableArrangementView } from '../src/table-arrangement/loadTableArrangementView.js';
import { buildGuestTableView, tableLabelsByGuest } from '../src/table-arrangement/guestTableView.js';
import { buildTableArrangementExport } from '../src/table-arrangement/tableArrangementExport.js';
import { renderTemplate } from '../src/admin/messageTemplates.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { probableAttendees } from '../src/data/probableAttendeesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';

// Table sides and Common tables (PRD §20, TASKS.md Action 68). Every table is the
// bride's, the groom's or Common; each side seats only its own people, at its own
// tables or a Common one. Runs the in-memory path (DATABASE_URL unset), plus the
// SQL path through a fake query function where a rule lives in SQL.
//
// Seeded wedding:
//   bride  b1  Perera Family, accepted, no named people (a whole-party seat)
//   bride  b2  Silva Family, accepted: Kamala, Nirmala
//   groom  g1  Fernando Family, accepted: Sunil, Rani
//   groom  g2  Groom Uncle, accepted, no named people
// Tables: "Rose" (bride 1, 2 seats), "Jasmine" (groom 1, 2 seats), "Lotus" (Common 1, 4 seats).

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const GUESTS = [
  { id: 'b1', code: 'B-1', name: 'Perera Family', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
  { id: 'b2', code: 'B-2', name: 'Silva Family', relationship: 'Friends', slotCount: 2, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
  { id: 'g1', code: 'G-1', name: 'Fernando Family', relationship: 'Family', slotCount: 2, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'groom' },
  { id: 'g2', code: 'G-2', name: 'Groom Uncle', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'groom' },
];

const RESPONSES = [
  { guestId: 'b1', attending: true, participantNames: ['Perera Family'] },
  { guestId: 'b2', attending: true, participantNames: ['Kamala', 'Nirmala'] },
  { guestId: 'g1', attending: true, participantNames: ['Sunil', 'Rani'] },
  { guestId: 'g2', attending: true, participantNames: ['Groom Uncle'] },
];

let rose;
let jasmine;
let lotus;
let kamala;
let nirmala;
let sunil;

async function acceptedPeople(guestId, names) {
  const created = await createInviteesForGuest(guestId, names);
  for (const person of created) person.rsvpStatus = 'accepted';
  return created;
}

async function placeholder() {
  await setProbableAttendeeBuffer('pending', probableAttendees.length + 1);
  const [slot] = await listUnassignedProbableAttendees();
  return slot;
}

beforeEach(async () => {
  seatingTables.length = 0;
  invitees.length = 0;
  probableAttendees.length = 0;
  guestStore.length = 0;
  guestStore.push(...GUESTS.map((guest) => ({ ...guest })));
  rsvpResponses.length = 0;
  rsvpResponses.push(...RESPONSES.map((response) => ({ ...response })));

  [kamala, nirmala] = await acceptedPeople('b2', ['Kamala', 'Nirmala']);
  [sunil] = await acceptedPeople('g1', ['Sunil', 'Rani']);

  rose = await createSeatingTable({ tableNumber: 1, tableName: 'Rose', capacity: 2, party: 'bride' });
  jasmine = await createSeatingTable({ tableNumber: 1, tableName: 'Jasmine', capacity: 2, party: 'groom' });
  lotus = await createSeatingTable({ tableNumber: 1, tableName: 'Lotus', capacity: 4, party: 'common' });
});

// --- Creating a table --------------------------------------------------------

test('the create form needs a name; the side is "My side" or Common, and a raw side name is refused', () => {
  const base = { tableNumber: 2, capacity: 8 };

  assert.equal(validateNewTable(base, 'bride').ok, false, 'no name');
  assert.match(validateNewTable(base, 'bride').message, /name/);
  assert.equal(validateNewTable({ ...base, tableName: '   ' }, 'bride').ok, false, 'a blank name');

  const own = validateNewTable({ ...base, tableName: ' Orchid ', side: 'own' }, 'groom');
  assert.deepEqual(own, { ok: true, value: { tableNumber: 2, tableName: 'Orchid', capacity: 8, party: 'groom' } });
  assert.equal(validateNewTable({ ...base, tableName: 'Orchid' }, 'bride').value.party, 'bride', 'the side defaults to My side');
  assert.equal(validateNewTable({ ...base, tableName: 'Orchid', side: 'common' }, 'bride').value.party, 'common');

  // "own" is resolved on the server; a bride admin cannot ask for the groom's side, or even name her own.
  assert.equal(validateNewTable({ ...base, tableName: 'Orchid', side: 'groom' }, 'bride').ok, false);
  assert.equal(validateNewTable({ ...base, tableName: 'Orchid', side: 'bride' }, 'bride').ok, false);
  assert.equal(resolveRequestedSide('groom', 'bride'), null);

  assert.equal(validateNewTable({ tableNumber: 0, tableName: 'X', capacity: 8 }, 'bride').ok, false);
  assert.equal(validateNewTable({ tableNumber: 1.5, tableName: 'X', capacity: 8 }, 'bride').ok, false);
  assert.equal(validateNewTable({ tableNumber: 1, tableName: 'X', capacity: 101 }, 'bride').ok, false);
});

test('a table name is unique across the venue, ignoring capital letters and spaces', async () => {
  for (const [name, party] of [['rose', 'groom'], [' ROSE ', 'common'], ['Rose', 'bride']]) {
    await assert.rejects(
      createSeatingTable({ tableNumber: 9, tableName: name, capacity: 2, party }),
      (error) => {
        assert.equal(error.message, 'A table with that name already exists');
        assert.equal(userFacingStatus(error), 400);
        return true;
      },
      `"${name}" on the ${party} side clashes with the bride's "Rose"`
    );
  }

  // Tables created before names were required stay unnamed and do not clash with each other.
  await createSeatingTable({ tableNumber: 7, capacity: 2, party: 'bride' });
  await createSeatingTable({ tableNumber: 8, capacity: 2, party: 'bride' });
});

test('Common tables are numbered on their own line, beside each side', async () => {
  assert.deepEqual(
    (await listSeatingTables()).map((table) => [table.side, table.table_number]).sort(),
    [['bride', 1], ['common', 1], ['groom', 1]]
  );
  await assert.rejects(
    createSeatingTable({ tableNumber: 1, tableName: 'Tulip', capacity: 2, party: 'common' }),
    /A table with that number already exists/
  );
});

test('a side other than bride, groom or common is a programming fault, not an admin message', async () => {
  await assert.rejects(
    createSeatingTable({ tableNumber: 5, tableName: 'Nowhere', capacity: 2, party: 'everyone' }),
    (error) => /Unknown table side/.test(error.message) && !isUserFacingError(error)
  );
});

test('the SQL path tells a taken name from a taken number by the index that refused it', async () => {
  const refusedBy = (constraint) => async () => {
    throw Object.assign(new Error('duplicate key value'), { code: '23505', constraint });
  };

  await assert.rejects(
    createSeatingTable({ tableNumber: 2, tableName: 'Rose', capacity: 2, party: 'groom' }, refusedBy('seating_tables_name_unique')),
    /that name already exists/
  );
  await assert.rejects(
    createSeatingTable({ tableNumber: 1, tableName: 'Tulip', capacity: 2, party: 'groom' }, refusedBy('seating_tables_number_party_unique')),
    /that number already exists/
  );

  let params;
  await createSeatingTable({ tableNumber: 3, tableName: '  Tulip ', capacity: 2, party: 'common' }, async (sql, values) => {
    params ??= values;
    return { rows: [{ id: 'new-id' }] };
  });
  assert.deepEqual(params, [3, 'Tulip', 2, 'common'], 'the name is stored trimmed, with the resolved side');
});

// --- What each side sees -------------------------------------------------------

test("each side gets its own tables and every Common table, labelled with the side — never the other side's", async () => {
  const bride = await listSeatingTablesByParty('bride');
  const groom = await listSeatingTablesByParty('groom');

  assert.deepEqual(bride.map((table) => [table.table_name, table.side]), [['Rose', 'bride'], ['Lotus', 'common']]);
  assert.deepEqual(groom.map((table) => [table.table_name, table.side]), [['Jasmine', 'groom'], ['Lotus', 'common']]);
});

test('on a Common table each side sees everyone seated there, with the side each person is from', async () => {
  await assignInviteeToSeat(lotus.seats[0].id, kamala.id);
  await assignInviteeToSeat(lotus.seats[1].id, sunil.id);

  for (const side of ['bride', 'groom']) {
    const common = (await listSeatingTablesByParty(side)).find((table) => table.side === 'common');
    assert.deepEqual(
      common.seats.filter((seat) => seat.inviteeId).map((seat) => [seat.inviteeName, seat.occupantSide]),
      [['Kamala', 'bride'], ['Sunil', 'groom']],
      `as seen by the ${side}`
    );
  }
});

test("the unassigned people list is the signed-in side's only", async () => {
  assert.deepEqual((await listUnassignedInviteesByParty('bride')).map((p) => p.name), ['Kamala', 'Nirmala']);
  assert.deepEqual((await listUnassignedInviteesByParty('groom')).map((p) => p.name), ['Rani', 'Sunil']);

  await assignInviteeToSeat(lotus.seats[0].id, kamala.id);
  assert.deepEqual((await listUnassignedInviteesByParty('bride')).map((p) => p.name), ['Nirmala']);
});

// --- The seating rule, decided on the server ---------------------------------------

test("a person is seated only at their own side's table or a Common table", async () => {
  const seat = (table) => ({ tableId: table.id, seatId: table.seats[0].id });

  // Allowed: own people at own tables and at Common tables, for both sides.
  assert.equal(await seatAssignmentRefusal({ ...seat(rose), party: 'bride', guestId: 'b1' }), null);
  assert.equal(await seatAssignmentRefusal({ ...seat(lotus), party: 'bride', inviteeId: kamala.id }), null);
  assert.equal(await seatAssignmentRefusal({ ...seat(lotus), party: 'groom', inviteeId: sunil.id }), null);
  assert.equal(await seatAssignmentRefusal({ ...seat(jasmine), party: 'groom', guestId: 'g2' }), null);

  // A bride admin cannot seat anyone at a groom table…
  assert.deepEqual(await seatAssignmentRefusal({ ...seat(jasmine), party: 'bride', guestId: 'b1' }), { status: 404, message: 'Seat not found.' });
  // …or seat a groom person anywhere, her own table or a Common one.
  assert.equal((await seatAssignmentRefusal({ ...seat(rose), party: 'bride', guestId: 'g2' })).status, 404);
  assert.equal((await seatAssignmentRefusal({ ...seat(lotus), party: 'bride', guestId: 'g2' })).status, 404);
  assert.equal((await seatAssignmentRefusal({ ...seat(lotus), party: 'bride', inviteeId: sunil.id })).status, 404);
  // And the other way round.
  assert.equal((await seatAssignmentRefusal({ ...seat(rose), party: 'groom', guestId: 'g2' })).status, 404);
  assert.equal((await seatAssignmentRefusal({ ...seat(lotus), party: 'groom', inviteeId: kamala.id })).status, 404);
});

test('a probable placeholder goes on an own-side or Common table, never the other side’s', async () => {
  const slot = await placeholder();
  const at = (table, party) =>
    seatAssignmentRefusal({ tableId: table.id, seatId: table.seats[1].id, party, probableAttendeeId: slot.id });

  assert.equal(await at(rose, 'bride'), null);
  assert.equal(await at(lotus, 'bride'), null);
  assert.equal(await at(lotus, 'groom'), null, 'the pool is shared, so the groom may use it too');
  assert.equal((await at(jasmine, 'bride')).status, 404);
  assert.equal((await at(rose, 'groom')).status, 404);
});

test("on a Common table each side removes only its own people (and placeholders); the other side's answer 403", async () => {
  const slot = await placeholder();
  await assignInviteeToSeat(lotus.seats[0].id, kamala.id);
  await assignInviteeToSeat(lotus.seats[1].id, sunil.id);
  await assignProbableAttendeeToSeat(lotus.seats[2].id, slot.id);
  const remove = (seatIndex, party) =>
    seatRemovalRefusal({ tableId: lotus.id, seatId: lotus.seats[seatIndex].id, party });

  assert.equal(await remove(0, 'bride'), null, 'Kamala is the bride’s');
  assert.equal((await remove(1, 'bride')).status, 403, 'Sunil is the groom’s');
  assert.equal(await remove(1, 'groom'), null);
  assert.equal((await remove(0, 'groom')).status, 403);
  assert.equal(await remove(2, 'bride'), null, 'a placeholder belongs to neither side');
  assert.equal(await remove(3, 'groom'), null, 'an empty seat');
});

test("a side still clears any seat at its own table, and cannot touch the other side's", async () => {
  // Seated directly, as could happen before this rule existed: a groom person at the bride's table.
  await assignGuestToSeat(rose.seats[0].id, 'g2');

  assert.equal(await seatRemovalRefusal({ tableId: rose.id, seatId: rose.seats[0].id, party: 'bride' }), null);
  assert.equal((await seatRemovalRefusal({ tableId: rose.id, seatId: rose.seats[0].id, party: 'groom' })).status, 404);
  assert.equal((await seatRemovalRefusal({ tableId: jasmine.id, seatId: jasmine.seats[0].id, party: 'bride' })).status, 404);
  assert.equal(
    (await seatRemovalRefusal({ tableId: lotus.id, seatId: jasmine.seats[0].id, party: 'bride' })).status,
    404,
    "the groom's seat under the Common table's id"
  );
});

// --- Changing a table's side, renaming and deleting ----------------------------------

test("a table's side changes only while it is empty (409 otherwise), own side <-> Common", async () => {
  const orchid = await createSeatingTable({ tableNumber: 2, tableName: 'Orchid', capacity: 2, party: 'bride' });
  const toCommon = await updateSeatingTable(orchid.id, { side: 'common' });
  assert.equal(toCommon.side, 'common', 'an empty table moves');
  assert.equal((await updateSeatingTable(orchid.id, { side: 'bride' })).side, 'bride', 'and back');

  await assignGuestToSeat(orchid.seats[0].id, 'b1');
  await assert.rejects(updateSeatingTable(orchid.id, { side: 'common' }), (error) => {
    assert.equal(error.message, "A table's side can change only while nobody is seated at it.");
    assert.equal(userFacingStatus(error), 409);
    return true;
  });
  assert.equal(seatingTables.find((table) => table.id === orchid.id).assignedToParty, 'bride', 'unchanged');

  // A placeholder counts as someone seated.
  const slot = await placeholder();
  await assignProbableAttendeeToSeat(lotus.seats[0].id, slot.id);
  await assert.rejects(updateSeatingTable(lotus.id, { side: 'groom' }), /can change only while nobody is seated/);
});

test("moving a table onto a side that already uses its number is refused like creating one", async () => {
  // Rose is bride 1; Common already has a 1 (Lotus).
  await assert.rejects(updateSeatingTable(rose.id, { side: 'common' }), (error) => {
    assert.equal(error.message, 'A table with that number already exists');
    return true;
  });
});

test('a rename is refused for a name another table has, and for a blank name', async () => {
  await assert.rejects(updateSeatingTable(jasmine.id, { tableName: 'LOTUS' }), /that name already exists/);
  assert.equal((await updateSeatingTable(jasmine.id, { tableName: 'jasmine' })).table_name, 'jasmine', 'its own name in new capitals is fine');

  assert.equal(validateTableUpdate({ tableName: '  ' }, 'bride').ok, false);
  assert.equal(validateTableUpdate({}, 'bride').ok, false, 'nothing to change');
  assert.equal(validateTableUpdate({ side: 'groom' }, 'bride').ok, false, 'a raw side name is refused');
  assert.deepEqual(validateTableUpdate({ side: 'own' }, 'groom'), { ok: true, value: { side: 'groom' } });
  assert.deepEqual(validateTableUpdate({ side: 'common', tableName: ' Iris ' }, 'bride'), {
    ok: true,
    value: { side: 'common', tableName: 'Iris' },
  });
});

test('a Common table is deleted only while empty (409 otherwise); an own table is deleted as before', async () => {
  await assignInviteeToSeat(lotus.seats[0].id, sunil.id);
  await assert.rejects(deleteSeatingTable(lotus.id, { onlyIfEmpty: true }), (error) => {
    assert.equal(error.message, 'A Common table can be removed only while nobody is seated at it.');
    assert.equal(userFacingStatus(error), 409);
    return true;
  });
  assert.ok(seatingTables.some((table) => table.id === lotus.id), 'still there, Sunil still seated');

  await assignGuestToSeat(lotus.seats[0].id, null);
  await deleteSeatingTable(lotus.id, { onlyIfEmpty: true });
  assert.ok(!seatingTables.some((table) => table.id === lotus.id), 'an empty Common table goes');

  await assignGuestToSeat(rose.seats[0].id, 'b1');
  await deleteSeatingTable(rose.id);
  assert.ok(!seatingTables.some((table) => table.id === rose.id), "the side's own table goes with its people unseated");
});

test('the SQL path decides "only while empty" inside the statement, and tells refused from missing', async () => {
  const statements = [];
  const noRowChanged = (tableExists) => async (sql, params) => {
    statements.push(sql);
    if (/^\s*SELECT id FROM seating_tables/.test(sql)) return { rows: tableExists ? [{ id: params[0] }] : [] };
    return { rows: [] };
  };

  await assert.rejects(updateSeatingTable('t-1', { side: 'common' }, noRowChanged(true)), /can change only while nobody is seated/);
  assert.match(statements[0], /NOT\s+EXISTS/, 'the UPDATE itself carries the occupancy test');
  assert.equal(await updateSeatingTable('t-missing', { side: 'common' }, noRowChanged(false)), null);

  statements.length = 0;
  await assert.rejects(deleteSeatingTable('t-1', { onlyIfEmpty: true }, noRowChanged(true)), /Common table can be removed only/);
  assert.match(statements[0], /NOT\s+EXISTS/);

  statements.length = 0;
  await deleteSeatingTable('t-2', {}, noRowChanged(true));
  assert.doesNotMatch(statements[0], /EXISTS/, "an own table's delete is not guarded");
});

// --- Stats and the leftover summary ---------------------------------------------------

test("each side's stats count its own people, including those at a Common table, and never the other side's", async () => {
  await assignGuestToSeat(rose.seats[0].id, 'b1');
  await assignInviteeToSeat(lotus.seats[0].id, kamala.id);
  await assignInviteeToSeat(lotus.seats[1].id, sunil.id);

  const bride = await loadTableArrangementView('bride');
  const groom = await loadTableArrangementView('groom');

  assert.equal(bride.dashboardStats.tableArranged, 2, 'Perera Family at Rose + Kamala at Lotus; not Sunil');
  assert.equal(bride.dashboardStats.balanceToArrange, 1, 'Nirmala');
  assert.equal(groom.dashboardStats.tableArranged, 1, 'Sunil at Lotus; not Kamala');
  assert.equal(groom.dashboardStats.balanceToArrange, 2, 'Rani + Groom Uncle');
  assert.equal(bride.overallDashboardStats.tableArranged, 3, 'the wedding row counts everyone once');
});

test("the view holds the side's own tables and Common tables, and its own unseated people only", async () => {
  const bride = await loadTableArrangementView('bride');

  assert.deepEqual(bride.tables.map((table) => table.table_name), ['Rose', 'Lotus']);
  assert.deepEqual(bride.unassignedInvitees.map((person) => person.name), ['Kamala', 'Nirmala']);
  assert.deepEqual(bride.unassignedGuests.map((guest) => guest.id), ['b1']);
  assert.equal(bride.party, 'bride');
});

test('the leftover summary: per side, combined, Common free seats and roughly how many Common tables', async () => {
  // Bride: Perera Family, Kamala, Nirmala waiting (3) with 2 free seats at Rose -> 1 left over.
  // Groom: Groom Uncle, Sunil, Rani waiting (3) with 2 free seats at Jasmine -> 1 left over.
  const { leftoverSummary } = await loadTableArrangementView('groom');

  assert.deepEqual(leftoverSummary, {
    bride: { unseated: 3, freeSeats: 2, leftover: 1 },
    groom: { unseated: 3, freeSeats: 2, leftover: 1 },
    combinedLeftover: 2,
    commonFreeSeats: 4,
    seatsPerCommonTable: 4,
    commonTablesNeeded: 0,
  });

  // Counts only: nothing in it names anyone.
  assert.doesNotMatch(JSON.stringify(leftoverSummary), /Kamala|Sunil|Perera|Uncle/);
});

test('the leftover arithmetic, from the glossary example', () => {
  // Bride has 3 left over, groom 4; no Common table yet, so the default size of 10 applies.
  const summary = buildLeftoverSummary({
    tables: [
      { side: 'bride', capacity: 2, seats: [{ guestId: 'x' }, {}] },
      { side: 'groom', capacity: 1, seats: [{}] },
    ],
    unseated: { bride: 4, groom: 5 },
  });

  assert.deepEqual(summary.bride, { unseated: 4, freeSeats: 1, leftover: 3 });
  assert.deepEqual(summary.groom, { unseated: 5, freeSeats: 1, leftover: 4 });
  assert.equal(summary.combinedLeftover, 7);
  assert.equal(summary.commonTablesNeeded, 1);
  assert.equal(summary.seatsPerCommonTable, 10);

  const withCommon = buildLeftoverSummary({
    tables: [{ side: 'common', capacity: 6, seats: [{}, {}, {}, { inviteeId: 'y' }, {}, {}] }],
    unseated: { bride: 14, groom: 3 },
  });
  // 17 left over, 5 free Common seats -> 12 without a seat -> 2 more tables of 6.
  assert.equal(withCommon.commonFreeSeats, 5);
  assert.equal(withCommon.commonTablesNeeded, 2);
});

// --- What guests see, messages and the export ----------------------------------------

test("the guest's invitation shows the table's name, falling back to \"Table N\" for an unnamed one", () => {
  const seat = (fields) => ({ guestId: null, inviteeId: null, guestName: null, inviteeName: null, ...fields });
  const views = buildGuestTableView(
    [
      { table_number: 1, table_name: 'Lotus', side: 'common', seats: [seat({ guestId: 'g-1' }), seat({ inviteeName: 'Sunil Fernando' })] },
      { table_number: 4, table_name: null, side: 'bride', seats: [seat({ guestId: 'g-1' })] },
    ],
    { guestId: 'g-1' }
  );

  assert.deepEqual(views.map((view) => view.label), ['Lotus', 'Table 4']);
  assert.deepEqual(views[0].mates, ['Sunil'], 'the "with …" line is unchanged');
  assert.equal(tableLabel({ table_number: 3, table_name: '  ' }), 'Table 3');

  const page = readFileSync(join(ROOT, 'app/(public)/invitation/[code]/page.tsx'), 'utf8');
  assert.match(page, /\{view\.label\}/, 'the page renders the label');
  assert.doesNotMatch(page, /Table \{view\.tableNumber\}/, 'and no longer the bare number');
});

test('[TableNumber] fills with the table name, for whole parties and named people alike', async () => {
  await assignGuestToSeat(rose.seats[0].id, 'b1');
  await assignInviteeToSeat(lotus.seats[0].id, kamala.id);
  await assignInviteeToSeat(rose.seats[1].id, nirmala.id);

  const labels = tableLabelsByGuest(await listSeatingTablesByParty('bride'));

  assert.deepEqual(labels.get('b1'), ['Rose']);
  assert.deepEqual(labels.get('b2'), ['Rose', 'Lotus'], "one party at two tables gets both, in table order");
  assert.equal(labels.get('g1'), undefined, "the groom's people are not the bride's to message");
  assert.equal(
    renderTemplate('Dear [Name], you are at [TableNumber].', { name: 'Perera Family', tablenumber: 'Rose' }),
    'Dear Perera Family, you are at Rose.'
  );

  // The Messages screen gets each recipient's table names from the side's own and Common tables.
  const audience = handlers('app/api/admin/messages/route.ts').GET;
  assert.match(audience, /tableLabelsByGuest\(tables\)/);
  assert.match(audience, /listSeatingTablesByParty\(session\.party\)/);
  assert.match(readFileSync(join(ROOT, 'components/admin/MessagingCenter.tsx'), 'utf8'), /tablenumber: recipient\.tableName/);
});

test("the spreadsheet shows each table's side and name", async () => {
  await assignInviteeToSeat(lotus.seats[0].id, kamala.id);
  const tsv = buildTableArrangementExport(await listSeatingTablesByParty('bride'));
  const [header, ...rows] = tsv.trimEnd().split('\n');

  assert.deepEqual(header.split('\t').slice(0, 4), ['Table', 'Table Name', 'Side', 'Seat']);
  assert.ok(rows.some((row) => row.startsWith('1\tRose\tBride\t1\t')));
  assert.ok(rows.some((row) => row.startsWith('1\tLotus\tCommon\t1\tKamala')));
  assert.ok(!rows.some((row) => row.includes('Jasmine')), "the groom's own tables are not in the bride's export");
});

// --- Every table route asks these rules --------------------------------------------------

function handlers(file) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  return Object.fromEntries(
    source
      .split(/(?=export async function (?:GET|POST|PUT|PATCH|DELETE)\b)/)
      .slice(1)
      .map((handler) => [handler.match(/function (\w+)/)[1], handler])
  );
}

test('every table-arrangement route that writes goes through the side rules', () => {
  const create = handlers('app/api/admin/table-arrangement/route.ts').POST;
  assert.match(create, /validateNewTable\(body, session\.party\)/);
  assert.match(create, /createSeatingTable\(checked\.value\)/, 'the resolved side, never a side from the request');

  const table = handlers('app/api/admin/table-arrangement/[tableId]/route.ts');
  assert.match(table.PUT, /visibleTableSide\(tableId, session\.party\)/);
  assert.match(table.PUT, /validateTableUpdate\(body, session\.party\)/);
  assert.match(table.DELETE, /visibleTableSide\(tableId, session\.party\)/);
  assert.match(table.DELETE, /onlyIfEmpty: side === COMMON/);

  const seatBase = 'app/api/admin/table-arrangement/[tableId]/seats/[seatId]';
  assert.match(handlers(`${seatBase}/assign/route.ts`).POST, /seatAssignmentRefusal\(\{[^}]*party: session\.party/);
  assert.match(handlers(`${seatBase}/unassign/route.ts`).POST, /seatRemovalRefusal\(\{[^}]*party: session\.party/);
});
