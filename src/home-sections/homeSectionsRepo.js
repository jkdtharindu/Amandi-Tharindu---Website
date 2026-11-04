import { query } from '../db.js';

const useDb = Boolean(process.env.DATABASE_URL);

/**
 * The built-in homepage sections an admin can hide, in default page order. The
 * key is also the section's anchor id on the homepage. (Custom sections added
 * in Admin > Sections have their own Hide/Show and are not listed here.)
 *
 * `parts` are the pieces inside a section the admin can switch off on their
 * own (for example Our Story's milestone cards). The top banner is not here:
 * it always stays first.
 */
export const HOME_SECTIONS = [
  {
    key: 'our-story',
    label: 'Our Story',
    parts: [
      { key: 'flag', label: 'Small label' },
      { key: 'heading', label: 'Heading' },
      { key: 'intro', label: 'Paragraph' },
      { key: 'milestones', label: 'Milestones (the story cards)' },
    ],
  },
  {
    key: 'family-details',
    label: 'The couple (Family Details)',
    parts: [
      { key: 'flag', label: 'Small label' },
      { key: 'heading', label: 'Heading' },
    ],
  },
  {
    key: 'event-details',
    label: 'Wedding events',
    parts: [
      { key: 'flag', label: 'Small label' },
      { key: 'heading', label: 'Heading' },
      { key: 'intro', label: 'Paragraph' },
    ],
  },
  {
    key: 'gallery',
    label: 'Gallery',
    parts: [
      { key: 'flag', label: 'Small label' },
      { key: 'heading', label: 'Heading' },
      { key: 'intro', label: 'Paragraph' },
    ],
  },
  {
    key: 'faq',
    label: 'FAQ',
    parts: [
      { key: 'flag', label: 'Small label' },
      { key: 'heading', label: 'Heading' },
      { key: 'intro', label: 'Paragraph' },
    ],
  },
  {
    key: 'wishes',
    label: 'Wishes',
    parts: [
      { key: 'flag', label: 'Small label' },
      { key: 'heading', label: 'Heading' },
      { key: 'intro', label: 'Paragraph' },
      { key: 'button', label: 'Invitation button' },
    ],
  },
];

export const HOME_SECTION_KEYS = HOME_SECTIONS.map((section) => section.key);

/** A part's storage key: 'our-story:milestones'. */
export function homePartKey(sectionKey, partKey) {
  return `${sectionKey}:${partKey}`;
}

export const HOME_PART_KEYS = HOME_SECTIONS.flatMap((section) =>
  section.parts.map((part) => homePartKey(section.key, part.key))
);

// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
const hiddenStore = (globalThis.__homeSectionHidden ??= new Set());
const hiddenPartStore = (globalThis.__homePartHidden ??= new Set());
// null = never reordered (default order).
const orderStore = (globalThis.__homeSectionOrder ??= { keys: null });

function allVisible() {
  return Object.fromEntries(HOME_SECTION_KEYS.map((key) => [key, true]));
}

function allPartsVisible() {
  return Object.fromEntries(HOME_PART_KEYS.map((key) => [key, true]));
}

/**
 * { 'our-story': true, gallery: false, ... } — every key is always present.
 * A section with no saved row is visible.
 */
export async function getHomeSectionVisibility() {
  const result = allVisible();
  if (!useDb) {
    for (const key of hiddenStore) result[key] = false;
    return result;
  }

  const { rows } = await query('SELECT section_key, is_visible FROM home_section_visibility');
  for (const row of rows) {
    if (row.section_key in result) result[row.section_key] = row.is_visible;
  }
  return result;
}

/**
 * Same as getHomeSectionVisibility() but never throws: a database hiccup (or
 * the table not existing yet) shows every section rather than taking the whole
 * homepage down. Guest pages use this one.
 */
export async function getHomeSectionVisibilitySafe() {
  try {
    return await getHomeSectionVisibility();
  } catch (error) {
    console.error('getHomeSectionVisibility failed, showing every section:', error);
    return allVisible();
  }
}

async function upsertVisibility(key, isVisible) {
  await query(
    `INSERT INTO home_section_visibility (section_key, is_visible, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (section_key) DO UPDATE SET is_visible = EXCLUDED.is_visible, updated_at = now()`,
    [key, isVisible]
  );
}

export async function setHomeSectionVisibility(key, isVisible) {
  if (!HOME_SECTION_KEYS.includes(key)) return { success: false, reason: 'invalid_section' };
  if (typeof isVisible !== 'boolean') return { success: false, reason: 'invalid_visibility' };

  if (!useDb) {
    if (isVisible) hiddenStore.delete(key);
    else hiddenStore.add(key);
    return { success: true };
  }

  await upsertVisibility(key, isVisible);
  return { success: true };
}

/** { 'our-story:milestones': true, ... } — every part key is always present. */
export async function getHomePartVisibility() {
  const result = allPartsVisible();
  if (!useDb) {
    for (const key of hiddenPartStore) result[key] = false;
    return result;
  }

  const { rows } = await query(
    'SELECT section_key, is_visible FROM home_section_visibility WHERE section_key LIKE \'%:%\''
  );
  for (const row of rows) {
    if (row.section_key in result) result[row.section_key] = row.is_visible;
  }
  return result;
}

/** Never throws: on a database problem every part shows. Guest pages use this. */
export async function getHomePartVisibilitySafe() {
  try {
    return await getHomePartVisibility();
  } catch (error) {
    console.error('getHomePartVisibility failed, showing every part:', error);
    return allPartsVisible();
  }
}

export async function setHomePartVisibility(key, isVisible) {
  if (!HOME_PART_KEYS.includes(key)) return { success: false, reason: 'invalid_section' };
  if (typeof isVisible !== 'boolean') return { success: false, reason: 'invalid_visibility' };

  if (!useDb) {
    if (isVisible) hiddenPartStore.delete(key);
    else hiddenPartStore.add(key);
    return { success: true };
  }

  await upsertVisibility(key, isVisible);
  return { success: true };
}

/**
 * Puts the saved positions in order. `saved` is [{ key, order }] for sections
 * that have a position; anything unknown is ignored and any section without a
 * position goes after the positioned ones, in default order. Always returns
 * every section key exactly once.
 */
export function orderSections(saved) {
  const positioned = (saved ?? [])
    .filter((item) => HOME_SECTION_KEYS.includes(item.key) && Number.isFinite(item.order))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.key);
  const unique = [...new Set(positioned)];
  return [...unique, ...HOME_SECTION_KEYS.filter((key) => !unique.includes(key))];
}

/** The homepage sections in the order the admin chose (default if never set). */
export async function getHomeSectionOrder() {
  if (!useDb) {
    return orderStore.keys ? [...orderStore.keys] : [...HOME_SECTION_KEYS];
  }

  const { rows } = await query(
    'SELECT section_key, display_order FROM home_section_visibility WHERE display_order IS NOT NULL'
  );
  return orderSections(rows.map((row) => ({ key: row.section_key, order: row.display_order })));
}

/** Never throws: on a database problem (or before migration 038) the default order is used. */
export async function getHomeSectionOrderSafe() {
  try {
    return await getHomeSectionOrder();
  } catch (error) {
    console.error('getHomeSectionOrder failed, using the default order:', error);
    return [...HOME_SECTION_KEYS];
  }
}

/** Saves a new order. `keys` must list every section exactly once. */
export async function setHomeSectionOrder(keys) {
  if (!Array.isArray(keys)) return { success: false, reason: 'invalid_order' };
  const sameSet =
    keys.length === HOME_SECTION_KEYS.length &&
    new Set(keys).size === keys.length &&
    keys.every((key) => HOME_SECTION_KEYS.includes(key));
  if (!sameSet) return { success: false, reason: 'invalid_order' };

  if (!useDb) {
    orderStore.keys = [...keys];
    return { success: true };
  }

  await query(
    `INSERT INTO home_section_visibility (section_key, is_visible, display_order, updated_at)
     SELECT k, true, o::int, now() FROM unnest($1::text[]) WITH ORDINALITY AS t(k, o)
     ON CONFLICT (section_key) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = now()`,
    [keys]
  );
  return { success: true };
}
