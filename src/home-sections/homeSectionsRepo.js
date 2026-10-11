import { query } from '../db.js';

const useDb = Boolean(process.env.DATABASE_URL);

/**
 * The built-in homepage sections an admin can hide, in page order. The key is
 * also the section's anchor id on the homepage. (Custom sections added in
 * Admin > Sections have their own Hide/Show and are not listed here.)
 */
export const HOME_SECTIONS = [
  { key: 'our-story', label: 'Our Story' },
  { key: 'family-details', label: 'The couple (Family Details)' },
  { key: 'event-details', label: 'Wedding events' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'faq', label: 'FAQ' },
  { key: 'wishes', label: 'Wishes' },
];

export const HOME_SECTION_KEYS = HOME_SECTIONS.map((section) => section.key);

// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
const hiddenStore = (globalThis.__homeSectionHidden ??= new Set());

function allVisible() {
  return Object.fromEntries(HOME_SECTION_KEYS.map((key) => [key, true]));
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

export async function setHomeSectionVisibility(key, isVisible) {
  if (!HOME_SECTION_KEYS.includes(key)) return { success: false, reason: 'invalid_section' };
  if (typeof isVisible !== 'boolean') return { success: false, reason: 'invalid_visibility' };

  if (!useDb) {
    if (isVisible) hiddenStore.delete(key);
    else hiddenStore.add(key);
    return { success: true };
  }

  await query(
    `INSERT INTO home_section_visibility (section_key, is_visible, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (section_key) DO UPDATE SET is_visible = EXCLUDED.is_visible, updated_at = now()`,
    [key, isVisible]
  );
  return { success: true };
}
