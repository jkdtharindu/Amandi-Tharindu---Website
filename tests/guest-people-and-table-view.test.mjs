import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGuestInput } from '../src/admin/guestValidation.js';
import { buildGuestTableView, firstName } from '../src/table-arrangement/guestTableView.js';

const base = { name: 'Silva Family', relationship: 'Friends' };
const create = (input) => validateGuestInput({ ...base, ...input }, { requirePeople: true });

test('creating a party of several with no names is refused', () => {
  const result = create({ slotCount: 3 });
  assert.equal(result.valid, false);
  assert.match(result.errors.inviteeNames, /name of each person/i);
});

test('an empty names list is refused the same way when creating', () => {
  const result = create({ slotCount: 2, inviteeNames: [] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.inviteeNames);
});

test('a party of one with no names is saved as one person carrying the guest name', () => {
  const result = create({ slotCount: 1 });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value.inviteeNames, ['Silva Family']);
  assert.equal(result.value.slotCount, 1);
});

test('named people still win over the typed headcount when creating', () => {
  const result = create({ slotCount: 9, inviteeNames: ['Nimal', 'Kamala'] });
  assert.equal(result.valid, true);
  assert.equal(result.value.slotCount, 2);
});

test('editing does not require names, so older headcount-only guests can still be edited', () => {
  const result = validateGuestInput({ ...base, slotCount: 4 });
  assert.equal(result.valid, true);
  assert.equal(result.value.inviteeNames, undefined);
});

const seat = (fields) => ({ guestId: null, inviteeId: null, inviteeName: null, guestName: null, ...fields });

test('firstName keeps the first word only', () => {
  assert.equal(firstName('  Nimal  Perera '), 'Nimal');
  assert.equal(firstName(null), '');
});

test('the table view lists the table number and the first names of the other people there', () => {
  const tables = [
    {
      table_number: 5,
      table_name: null,
      seats: [
        seat({ inviteeId: 'mine-1', inviteeName: 'Kamala Silva' }),
        seat({ inviteeId: 'other-1', inviteeName: 'Nimal Perera' }),
        seat({ guestId: 'g-9', guestName: 'Fernando Family' }),
        seat({}),
      ],
    },
  ];
  const [view] = buildGuestTableView(tables, { guestId: 'g-1', inviteeIds: ['mine-1'] });
  assert.equal(view.tableNumber, 5);
  assert.deepEqual(view.mates, ['Nimal', 'Fernando Family']);
});

test('the guest\'s own party is not listed back to them', () => {
  const tables = [
    {
      table_number: 2,
      table_name: 'Garden',
      seats: [
        seat({ inviteeId: 'mine-1', inviteeName: 'Kamala' }),
        seat({ inviteeId: 'mine-2', inviteeName: 'Sunil' }),
      ],
    },
  ];
  const [view] = buildGuestTableView(tables, { guestId: 'g-1', inviteeIds: ['mine-1', 'mine-2'] });
  assert.deepEqual(view.mates, []);
  assert.equal(view.tableName, 'Garden');
});

test('a party split over two tables gets one entry per table, in table order', () => {
  const tables = [
    { table_number: 7, table_name: null, seats: [seat({ inviteeId: 'mine-2', inviteeName: 'B' })] },
    { table_number: 3, table_name: null, seats: [seat({ inviteeId: 'mine-1', inviteeName: 'A' })] },
    { table_number: 4, table_name: null, seats: [seat({ inviteeId: 'x', inviteeName: 'Other' })] },
  ];
  const views = buildGuestTableView(tables, { guestId: 'g-1', inviteeIds: ['mine-1', 'mine-2'] });
  assert.deepEqual(views.map((view) => view.tableNumber), [3, 7]);
});

test('a guest nobody has seated gets no table entries', () => {
  assert.deepEqual(buildGuestTableView([{ table_number: 1, seats: [seat({})] }], { guestId: 'g-1' }), []);
});
