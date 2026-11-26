/**
 * The hall drawing: its size, the starting layout copied from the hotel's plan
 * ("14TH DECEMBER CAMELIA.pdf"), where unplaced tables go, and the checks on
 * what an admin may save. Pure: no database access, so the screen imports it too.
 *
 * Every item is placed by its centre, in drawing units. The drawing is scaled to
 * whatever width the screen has.
 */

export const HALL = { width: 920, height: 1300 };
/** The walls, drawn as a border. The exit arrows stick out past them, as on the plan. */
export const HALL_WALLS = { left: 40, top: 40, right: 885, bottom: 1270 };

export const TABLE_SIZE = 104;
export const MAX_LAYOUT_TABLES = 60;
export const MAX_AREAS = 100;
export const MAX_AREA_LABEL = 40;
export const AREA_SIZE_LIMITS = { min: 20, maxWidth: HALL.width, maxHeight: HALL.height };

export const AREA_SHAPES = ['rect', 'rounded', 'circle', 'heptagon', 'arrow'];
export const AREA_SHAPE_LABELS = {
  rect: 'Rectangle',
  rounded: 'Rounded rectangle',
  circle: 'Circle',
  heptagon: 'Small table (seven sides)',
  arrow: 'Arrow',
};

// Where tables 1 to 26 stand on the hotel's plan, in number order.
const PLAN_TABLE_SLOTS = [
  [808, 1190], [690, 1193], [560, 1193], [814, 1033], [690, 1058], [559, 1056], [808, 873],
  [690, 929], [554, 928], [811, 718], [685, 794], [550, 794], [686, 663], [550, 663],
  [809, 569], [686, 527], [550, 527], [814, 404], [686, 396], [550, 396], [342, 428],
  [226, 428], [242, 295], [108, 428], [117, 295], [109, 172],
];

/** The plan's spot for a table number, or null when the plan has no such number. */
export function planSlot(tableNumber) {
  const slot = PLAN_TABLE_SLOTS[tableNumber - 1];
  return slot ? { x: slot[0], y: slot[1] } : null;
}

const area = (shape, label, x, y, width, height, color, rotation = 0) => ({
  shape, label, x, y, width, height, color, rotation,
});

const SMALL_TABLE_SPOTS = [
  [124, 920], [203, 904], [93, 984], [175, 969], [261, 955], [317, 949], [83, 1067], [139, 1030],
  [215, 1023], [291, 1019], [164, 1105], [250, 1098], [341, 1087], [204, 1167], [305, 1163], [261, 1228],
];

/** Every non-table area on the hotel's plan. Returns fresh objects each call. */
export function defaultAreas() {
  return [
    area('rect', 'Setyback', 443, 112, 233, 112, '#c8eddc'),
    area('circle', 'Photography table', 612, 100, 70, 70, '#b3a2c7'),
    area('rect', 'Head table', 828, 188, 54, 242, '#c3d69b'),
    area('rect', 'Music stage', 141, 656, 168, 251, '#4f81bd'),
    area('rounded', 'Dancing floor', 309, 656, 142, 251, '#e6b9b8'),
    area('circle', 'Music table', 96, 835, 70, 70, '#93cddd'),
    area('circle', 'Elevator', 264, 835, 58, 58, '#fcd5b5'),
    ...SMALL_TABLE_SPOTS.map(([x, y]) => area('heptagon', '', x, y, 46, 52, '#a24a06')),
    area('rect', 'Bar counter', 126, 1186, 172, 42, '#4f81bd', 48),
    area('arrow', 'Entrance', 413, 1213, 112, 142, '#4f81bd'),
    area('arrow', 'Exit', 137, 38, 74, 72, '#4f81bd'),
    area('arrow', 'Exit', 702, 44, 56, 72, '#4f81bd'),
    area('arrow', '', 40, 76, 50, 48, '#4f81bd', 270),
  ];
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** A centre kept on the drawing. */
export function clampPoint(x, y) {
  return { x: clamp(Math.round(x), 0, HALL.width), y: clamp(Math.round(y), 0, HALL.height) };
}

const overlaps = (point, box) =>
  Math.abs(point.x - box.x) < (TABLE_SIZE + box.width) / 2 &&
  Math.abs(point.y - box.y) < (TABLE_SIZE + box.height) / 2;

const touchesTable = (point, taken) =>
  taken.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < TABLE_SIZE * 0.9);

/** The first gap inside the walls that covers no table and no area; a staggered corner spot if the hall is full. */
function freeSpot(taken, areas, overflowIndex) {
  const half = TABLE_SIZE / 2;
  for (let y = HALL_WALLS.top + half + 4; y <= HALL_WALLS.bottom - half; y += 20) {
    for (let x = HALL_WALLS.left + half + 4; x <= HALL_WALLS.right - half; x += 20) {
      const point = { x, y };
      if (!touchesTable(point, taken) && !areas.some((box) => overlaps(point, box))) return point;
    }
  }
  const step = overflowIndex % 20;
  return { x: 100 + step * 30, y: 220 + step * 30 };
}

/**
 * A position for every table: its saved one, else the plan's spot for its number
 * when that spot is clear, else the first free gap.
 *
 * @param {{ id: string, number: number }[]} tables
 * @param {Map<string, { x: number, y: number }>} saved positions by table id
 * @param {{ x: number, y: number, width: number, height: number }[]} areas
 * @returns {Map<string, { x: number, y: number }>}
 */
export function placeTables(tables, saved, areas) {
  const placed = new Map();
  for (const table of tables) {
    const position = saved.get(table.id);
    if (position) placed.set(table.id, { x: position.x, y: position.y });
  }

  const waiting = tables
    .filter((table) => !placed.has(table.id))
    .sort((a, b) => a.number - b.number || String(a.id).localeCompare(String(b.id)));

  // Plan spots first, so a table with no plan spot never takes another's.
  const withoutSlot = [];
  for (const table of waiting) {
    const slot = planSlot(table.number);
    if (slot && !touchesTable(slot, [...placed.values()])) placed.set(table.id, slot);
    else withoutSlot.push(table);
  }
  withoutSlot.forEach((table, index) => {
    placed.set(table.id, freeSpot([...placed.values()], areas, index));
  });
  return placed;
}

/**
 * @template T
 * @typedef {{ ok: boolean, value?: T, message?: string }} Checked
 */

/** @returns {Checked<number>} The number of tables the admin typed: a whole number from 1 to MAX_LAYOUT_TABLES. */
export function validateTableCount(value) {
  const count = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_LAYOUT_TABLES) {
    return { ok: false, message: `Enter a number of tables from 1 to ${MAX_LAYOUT_TABLES}.` };
  }
  return { ok: true, value: count };
}

/**
 * A position sent by the screen. Off-drawing values are pulled back onto it.
 * @returns {Checked<{ x: number, y: number }>}
 */
export function validatePosition(body) {
  const { x, y } = body ?? {};
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, message: 'A position needs two numbers.' };
  }
  return { ok: true, value: clampPoint(x, y) };
}

const wholeNumberIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/**
 * Checks a new area (`partial: false` — shape required, the rest defaulted) or a
 * change to one (`partial: true` — only what was sent; the shape never changes).
 * @returns {Checked<Record<string, any>>}
 */
export function validateArea(body, { partial = false } = {}) {
  const input = body ?? {};
  const value = {};
  const fail = (message) => ({ ok: false, message });

  if (!partial) {
    if (!AREA_SHAPES.includes(input.shape)) return fail('Choose a shape for the area.');
    value.shape = input.shape;
    Object.assign(value, { label: '', x: 460, y: 650, width: 120, height: 80, rotation: 0, color: '#94a3b8' });
  }

  if (input.label !== undefined) {
    if (typeof input.label !== 'string') return fail('The name must be text.');
    const label = input.label.trim();
    if (label.length > MAX_AREA_LABEL) return fail(`Keep the name to ${MAX_AREA_LABEL} characters or fewer.`);
    value.label = label;
  }
  if (input.x !== undefined || input.y !== undefined) {
    const position = validatePosition(input);
    if (!position.ok) return position;
    Object.assign(value, position.value);
  }
  for (const [key, max] of [['width', AREA_SIZE_LIMITS.maxWidth], ['height', AREA_SIZE_LIMITS.maxHeight]]) {
    if (input[key] === undefined) continue;
    if (!wholeNumberIn(input[key], AREA_SIZE_LIMITS.min, max)) {
      return fail(`The ${key} must be a whole number from ${AREA_SIZE_LIMITS.min} to ${max}.`);
    }
    value[key] = input[key];
  }
  if (input.rotation !== undefined) {
    if (!wholeNumberIn(input.rotation, 0, 359)) return fail('The turn must be a whole number from 0 to 359.');
    value.rotation = input.rotation;
  }
  if (input.color !== undefined) {
    if (typeof input.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.color)) return fail('Choose a colour.');
    value.color = input.color.toLowerCase();
  }

  if (partial && Object.keys(value).length === 0) return fail('Nothing to change.');
  return { ok: true, value };
}
