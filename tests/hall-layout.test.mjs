import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HALL,
  TABLE_SIZE,
  MAX_LAYOUT_TABLES,
  defaultAreas,
  planSlot,
  placeTables,
  validateArea,
  validatePosition,
  validateTableCount,
  GRID,
  snapPoint,
} from '../src/hall-layout/hallLayoutShapes.js';
import { areaFrame, fitLabel, toHallDelta, toViewPoint, viewSize } from '../src/hall-layout/hallLayoutView.js';
import {
  alignHallLayout,
  createHallArea,
  deleteHallArea,
  generateHallLayout,
  loadHallLayout,
  resetHallLayout,
  saveTablePosition,
  updateHallArea,
} from '../src/hall-layout/hallLayoutRepo.js';
import {
  assignGuestToSeat,
  createSeatingTable,
  deleteSeatingTable,
  listSeatingTables,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { hallLayoutItems } from '../src/data/hallLayoutStore.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';

// The visual hall layout on the Table Arrangement screen. Runs the in-memory path.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SECRET = 'Secret Groom Guest';

beforeEach(() => {
  hallLayoutItems.length = 0;
  seatingTables.length = 0;
  guestStore.length = 0;
  guestStore.push({ id: 'g1', code: 'G-1', name: SECRET, slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'groom' });
});

const tableSnapshot = async () => structuredClone(await listSeatingTables());

test('the starting areas copy the hotel plan', () => {
  const areas = defaultAreas();
  const labels = areas.map((area) => area.label);
  for (const label of ['Setyback', 'Photography table', 'Head table', 'Music stage', 'Dancing floor', 'Music table', 'Elevator', 'Bar counter', 'Entrance']) {
    assert.ok(labels.includes(label), `missing ${label}`);
  }
  assert.equal(areas.filter((area) => area.shape === 'heptagon').length, 16);
  assert.equal(areas.filter((area) => area.shape === 'arrow').length, 4);
  for (const area of areas) {
    assert.equal(validateArea(area).ok, true, `${area.label || area.shape} must be savable`);
  }
});

test('the plan has a spot for tables 1 to 26 and none of them overlap', () => {
  const slots = Array.from({ length: 26 }, (_, index) => planSlot(index + 1));
  assert.equal(planSlot(27), null);
  slots.forEach((a, i) => {
    assert.ok(a);
    for (const b of slots.slice(i + 1)) {
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= TABLE_SIZE, 'two plan tables overlap');
    }
  });
});

test('tables beyond the plan, and duplicate numbers, get free spots on the drawing', () => {
  const tables = Array.from({ length: MAX_LAYOUT_TABLES }, (_, i) => ({ id: `t${i + 1}`, number: i + 1 }));
  tables.push({ id: 'twin', number: 1 });
  const positions = placeTables(tables, new Map(), defaultAreas());

  assert.equal(positions.size, tables.length);
  assert.deepEqual(positions.get('t26'), planSlot(26));
  assert.notDeepEqual(positions.get('twin'), positions.get('t1'));
  const spots = new Set([...positions.values()].map(({ x, y }) => `${x},${y}`));
  assert.equal(spots.size, tables.length, 'no two tables share a spot');
  for (const { x, y } of positions.values()) {
    assert.ok(x > 0 && x < HALL.width && y > 0 && y < HALL.height);
  }
});

test('the table count must be a whole number in range', () => {
  for (const bad of ['', ' ', 0, -1, 1.5, MAX_LAYOUT_TABLES + 1, 'ten', null, undefined]) {
    assert.equal(validateTableCount(bad).ok, false, `accepted ${bad}`);
  }
  assert.deepEqual(validateTableCount('26'), { ok: true, value: 26 });
});

test('positions and areas are checked, and kept on the drawing', () => {
  assert.equal(validatePosition({ x: '1', y: 2 }).ok, false);
  assert.equal(validatePosition({ x: 1 }).ok, false);
  assert.deepEqual(validatePosition({ x: -40, y: 99999.4 }).value, { x: 0, y: HALL.height });

  assert.equal(validateArea({}).ok, false);
  assert.equal(validateArea({ shape: 'table' }).ok, false, 'an area can never pose as a table');
  assert.equal(validateArea({ shape: 'rect', color: 'red; background:url(x)' }).ok, false);
  assert.equal(validateArea({ shape: 'rect', width: 5 }).ok, false);
  assert.equal(validateArea({ shape: 'rect', rotation: 360 }).ok, false);
  assert.equal(validateArea({ shape: 'rect', label: 'x'.repeat(41) }).ok, false);
  assert.equal(validateArea({}, { partial: true }).ok, false);
  assert.deepEqual(validateArea({ shape: 'circle', label: ' Moved ' }, { partial: true }).value, { label: 'Moved' });
});

test('there is no map until a table count is entered', async () => {
  const layout = await loadHallLayout();
  assert.equal(layout.available, true);
  assert.equal(layout.hasLayout, false);
  assert.deepEqual(layout.areas, []);
});

test('entering a count creates the missing tables as empty Common tables and draws the plan', async () => {
  const result = await generateHallLayout(26);
  assert.equal(result.created.length, 26);

  const tables = await listSeatingTables();
  assert.equal(tables.length, 26);
  assert.ok(tables.every((t) => t.side === 'common' && t.capacity === 10));
  assert.equal(tables[4].table_name, 'Table 5');

  const layout = await loadHallLayout();
  assert.equal(layout.hasLayout, true);
  assert.equal(layout.areas.length, defaultAreas().length);
  const five = layout.tables.find((t) => t.number === 5);
  assert.deepEqual({ x: five.x, y: five.y }, planSlot(5));
});

test('generating keeps existing tables, seated guests and moved positions', async () => {
  const rose = await createSeatingTable({ tableNumber: 2, tableName: 'Rose', capacity: 4, party: 'groom' });
  await createSeatingTable({ tableNumber: 40, tableName: 'Table 3', capacity: 2, party: 'bride' });
  await assignGuestToSeat(rose.seats[0].id, 'g1');
  const before = await tableSnapshot();

  const result = await generateHallLayout(3);
  assert.deepEqual(result.created, [1, 3]);
  let tables = await listSeatingTables();
  for (const original of before) {
    assert.deepEqual(tables.find((t) => t.id === original.id), original);
  }
  assert.equal(tables.find((t) => t.table_number === 3).table_name, 'Table 3 (2)', 'a taken name is not reused');

  await saveTablePosition(rose.id, { x: 300, y: 300 });
  const lower = await generateHallLayout(1);
  assert.deepEqual(lower.created, []);
  tables = await listSeatingTables();
  assert.equal(tables.length, 4, 'a lower count deletes nothing');
  const layout = await loadHallLayout();
  assert.equal(layout.areas.length, defaultAreas().length, 'areas are not doubled');
  assert.equal(layout.tables.find((t) => t.id === rose.id).x, 300);
});

test('the map gives every table its seat counts but never a guest name or a seat', async () => {
  const rose = await createSeatingTable({ tableNumber: 1, tableName: 'Rose', capacity: 2, party: 'groom' });
  await assignGuestToSeat(rose.seats[0].id, 'g1');
  await generateHallLayout(1);

  const layout = await loadHallLayout();
  assert.deepEqual(Object.keys(layout.tables[0]).sort(), ['capacity', 'filled', 'id', 'name', 'number', 'side', 'x', 'y']);
  assert.deepEqual([layout.tables[0].filled, layout.tables[0].capacity], [1, 2], "the other side's table has counts");
  assert.ok(!JSON.stringify(layout).includes(SECRET));
});

test('a moved table stays moved; an unknown table is refused', async () => {
  await generateHallLayout(2);
  const [first] = (await loadHallLayout()).tables;

  assert.equal(await saveTablePosition(first.id, { x: 222, y: 333 }), true);
  assert.equal(await saveTablePosition('nope', { x: 1, y: 1 }), false);
  const moved = (await loadHallLayout()).tables.find((t) => t.id === first.id);
  assert.deepEqual({ x: moved.x, y: moved.y }, { x: 222, y: 333 });
});

test('a table added or removed later appears on or leaves the map', async () => {
  await generateHallLayout(1);
  const extra = await createSeatingTable({ tableNumber: 30, tableName: 'Extra', capacity: 8, party: 'bride' });
  assert.equal((await loadHallLayout()).tables.length, 2);

  await deleteSeatingTable(extra.id);
  const layout = await loadHallLayout();
  assert.deepEqual(layout.tables.map((t) => t.number), [1]);
});

test('areas can be added, changed and removed, without touching tables', async () => {
  await generateHallLayout(1);
  const added = await createHallArea(validateArea({ shape: 'circle', label: 'Cake' }).value);
  const changed = await updateHallArea(added.id, { x: 200, rotation: 90 });
  assert.equal(changed.label, 'Cake');
  assert.equal(changed.x, 200);

  assert.equal(await deleteHallArea(added.id), true);
  assert.equal(await deleteHallArea(added.id), false);
  assert.equal(await updateHallArea(added.id, { x: 1 }), null);

  const tableRow = hallLayoutItems.find((row) => row.shape === 'table');
  assert.equal(await deleteHallArea(tableRow.id), false, "a table's position cannot be removed as an area");
  assert.equal(await updateHallArea(tableRow.id, { label: 'x' }), null);
  assert.equal((await listSeatingTables()).length, 1);
});

test('reset restores the hotel plan and leaves seating alone', async () => {
  await generateHallLayout(2);
  const tables = await listSeatingTables();
  await assignGuestToSeat(tables[0].seats[0].id, 'g1');
  const before = await tableSnapshot();
  await saveTablePosition(tables[0].id, { x: 100, y: 100 });
  await createHallArea(validateArea({ shape: 'rect', label: 'Cake' }).value);

  await resetHallLayout();

  const layout = await loadHallLayout();
  assert.equal(layout.areas.length, defaultAreas().length);
  const first = layout.tables.find((t) => t.number === 1);
  assert.deepEqual({ x: first.x, y: first.y }, planSlot(1));
  assert.deepEqual(await listSeatingTables(), before);
});

test('every hall layout change checks the session and CSRF token', () => {
  const routes = ['route.ts', 'tables/[tableId]/route.ts', 'areas/route.ts', 'areas/[areaId]/route.ts'];
  for (const route of routes) {
    const source = readFileSync(join(ROOT, 'app/api/admin/table-arrangement/layout', route), 'utf8');
    for (const handler of source.split(/(?=export async function (?:GET|POST|PUT|DELETE)\b)/).slice(1)) {
      const guard = handler.startsWith('export async function GET') ? 'getAdminSession()' : 'readHallChange(';
      assert.ok(handler.includes(guard), `${route} is missing ${guard}`);
    }
  }
  const shared = readFileSync(join(ROOT, 'lib/hallLayoutRoute.ts'), 'utf8');
  assert.match(shared, /getAdminSession\(\)/);
  assert.match(shared, /verifyCsrfToken\(request\)/);
});

test('migration 041 only adds the new table', () => {
  const sql = readFileSync(join(ROOT, 'migrations/041_create_hall_layout.sql'), 'utf8').replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /\b(ALTER|DROP|UPDATE\s+\w+\s+SET|DELETE\s+FROM|TRUNCATE)\b/i);
});

test('a moved item lands on the closest grid point', () => {
  assert.deepEqual(validatePosition({ x: 409, y: 411 }).value, { x: 400, y: 420 });
  assert.deepEqual(snapPoint(-30, 5000), { x: 0, y: HALL.height });
});

test('the starting plan is already lined up on the grid', () => {
  const points = [...defaultAreas(), ...Array.from({ length: 26 }, (_, i) => planSlot(i + 1))];
  const extra = placeTables([{ id: 'a', number: 40 }], new Map(), defaultAreas()).get('a');
  for (const { x, y } of [...points, extra]) {
    assert.ok(x % GRID === 0 && y % GRID === 0, `${x},${y} is off the grid`);
  }
});

test('aligning moves saved tables to the grid and leaves areas already on it alone', async () => {
  await generateHallLayout(2);
  const [first] = (await loadHallLayout()).tables;
  await saveTablePosition(first.id, { x: 409, y: 411 });
  const before = await loadHallLayout();

  await alignHallLayout();

  const after = await loadHallLayout();
  const moved = after.tables.find((t) => t.id === first.id);
  assert.deepEqual({ x: moved.x, y: moved.y }, { x: 400, y: 420 });
  assert.deepEqual(after.areas, before.areas);
});

test('in a turned view a drag moves the item the same way as the pointer', () => {
  for (const turn of [0, 90, 180, 270]) {
    const size = viewSize(turn);
    const start = toViewPoint(200, 300, turn);
    assert.ok(start.x >= 0 && start.x <= size.width && start.y >= 0 && start.y <= size.height);
    const delta = toHallDelta(40, -20, turn);
    const end = toViewPoint(200 + delta.x, 300 + delta.y, turn);
    assert.deepEqual({ x: end.x - start.x, y: end.y - start.y }, { x: 40, y: -20 }, `turn ${turn}`);
  }
  assert.deepEqual(viewSize(90), { width: HALL.height, height: HALL.width });
});

test("a turned area's frame swaps its sides", () => {
  const stage = { width: 168, height: 251, rotation: 0 };
  assert.equal(areaFrame(stage, 0).width, 168);
  assert.equal(areaFrame(stage, 90).width, 251);
  assert.equal(areaFrame(stage, 180).width, 168);
});

test('upright names are sized to fit inside their shape, however it is turned', () => {
  for (const turn of [0, 90, 180, 270]) {
    for (const area of defaultAreas().filter((a) => a.label && a.shape !== 'arrow')) {
      const { angle } = areaFrame(area, turn);
      const { size, lines } = fitLabel(area.label.toUpperCase(), area.width, area.height, angle);
      assert.ok(size > 0);
      assert.equal(lines.join(' '), area.label.toUpperCase(), 'no word is lost');
      const w = Math.max(...lines.map((line) => line.length)) * 0.68 * size;
      const h = lines.length * 1.15 * size;
      const c = Math.abs(Math.cos((angle * Math.PI) / 180));
      const s = Math.abs(Math.sin((angle * Math.PI) / 180));
      assert.ok(w * c + h * s <= area.width + 0.01 && w * s + h * c <= area.height + 0.01, `${area.label} at ${turn}`);
    }
  }
  assert.deepEqual(fitLabel('HEAD TABLE', 54, 242, 0).lines, ['HEAD', 'TABLE'], 'a narrow box breaks the words');
});
