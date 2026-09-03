import { query } from '../db.js';

/**
 * Global theme settings (PRD P1-10) — a single row. Read on every page load
 * via the root layout, not just admin actions, so `getThemeSettings` must
 * never throw: a missing table (migration not yet run) or a transient DB
 * error must not take the whole site down.
 */

const isDbEnabled = () => Boolean(process.env.DATABASE_URL);

const DEFAULT_THEME_SETTINGS = {
  primaryColor: '#B8860B',
  secondaryColor: '#FFF8DC',
  accentColor: '#8B0000',
  fontFamily: 'Cormorant Garamond',
  fontStyle: 'italic',
};

const themeSettingsStore = { ...DEFAULT_THEME_SETTINGS };

function mapThemeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    fontFamily: row.font_family,
    fontStyle: row.font_style,
  };
}

export async function getThemeSettings() {
  if (!isDbEnabled()) return { ...themeSettingsStore };

  try {
    const { rows } = await query('SELECT * FROM theme_settings LIMIT 1');
    return mapThemeRow(rows[0]) ?? { ...DEFAULT_THEME_SETTINGS };
  } catch (error) {
    console.error('getThemeSettings failed, falling back to defaults:', error);
    return { ...DEFAULT_THEME_SETTINGS };
  }
}

/**
 * @typedef {object} ThemeInput
 * @property {string} primaryColor
 * @property {string} secondaryColor
 * @property {string} accentColor
 * @property {string} fontFamily
 * @property {string} fontStyle
 */

/**
 * Updates the single theme_settings row. No `WHERE` clause needed — the
 * migration seeds exactly one row and nothing else ever inserts another.
 *
 * @param {ThemeInput} input
 */
export async function updateThemeSettings({
  primaryColor,
  secondaryColor,
  accentColor,
  fontFamily,
  fontStyle,
}) {
  if (!isDbEnabled()) {
    Object.assign(themeSettingsStore, {
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      fontStyle,
    });
    return { ...themeSettingsStore };
  }

  const { rows } = await query(
    `UPDATE theme_settings
        SET primary_color = $1, secondary_color = $2, accent_color = $3,
            font_family = $4, font_style = $5, updated_at = now()
      RETURNING *`,
    [primaryColor, secondaryColor, accentColor, fontFamily, fontStyle]
  );
  return mapThemeRow(rows[0]);
}
