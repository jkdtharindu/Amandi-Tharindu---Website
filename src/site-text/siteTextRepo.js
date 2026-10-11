import { query } from '../db.js';
import { SITE_TEXT_KEYS, MAX_SITE_TEXT_LENGTH, defaultSiteText } from './siteTextRegistry.js';

const useDb = Boolean(process.env.DATABASE_URL);

// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
const store = (globalThis.__siteText ??= new Map());

/**
 * Only the wording the admin changed: { 'hero.heading': 'Welcome!' }.
 * @returns {Promise<Record<string, string>>}
 */
export async function getSiteTextOverrides() {
  if (!useDb) return Object.fromEntries(store);

  const { rows } = await query('SELECT text_key, text_value FROM site_text');
  /** @type {Record<string, string>} */
  const overrides = {};
  for (const row of rows) {
    if (SITE_TEXT_KEYS.includes(row.text_key)) overrides[row.text_key] = row.text_value;
  }
  return overrides;
}

/**
 * @returns {Promise<Record<string, string>>}
 * Same as getSiteTextOverrides() but never throws: a database hiccup (or the
 * table not existing yet) means the default wording is used instead of the
 * page failing. Guest pages use this one.
 */
export async function getSiteTextSafe() {
  try {
    return await getSiteTextOverrides();
  } catch (error) {
    console.error('getSiteTextOverrides failed, using the default wording:', error);
    return {};
  }
}

/**
 * Saves a batch of edits: { key: newText }. Text that is empty, or the same as
 * the default, removes the edit (back to the default). Nothing is saved if any
 * key is unknown or any text is too long.
 */
export async function saveSiteText(values) {
  const entries = Object.entries(values || {});
  const errors = [];
  for (const [key, value] of entries) {
    if (!SITE_TEXT_KEYS.includes(key)) errors.push({ key, reason: 'unknown_key' });
    else if (typeof value !== 'string') errors.push({ key, reason: 'not_text' });
    else if (value.trim().length > MAX_SITE_TEXT_LENGTH) errors.push({ key, reason: 'too_long' });
  }
  if (errors.length > 0) return { success: false, errors };

  const toSet = [];
  const toClear = [];
  for (const [key, raw] of entries) {
    const value = raw.trim();
    if (value === '' || value === defaultSiteText(key)) toClear.push(key);
    else toSet.push([key, value]);
  }

  if (!useDb) {
    for (const key of toClear) store.delete(key);
    for (const [key, value] of toSet) store.set(key, value);
    return { success: true };
  }

  for (const key of toClear) await query('DELETE FROM site_text WHERE text_key = $1', [key]);
  for (const [key, value] of toSet) {
    await query(
      `INSERT INTO site_text (text_key, text_value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (text_key) DO UPDATE SET text_value = EXCLUDED.text_value, updated_at = now()`,
      [key, value]
    );
  }
  return { success: true };
}
