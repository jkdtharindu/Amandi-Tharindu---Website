import { query } from '../db.js';
import { themeSettings } from '../data/themeStore.js';
import { mergeThemeUpdate } from './mergeThemeUpdate.js';

const useDb = Boolean(process.env.DATABASE_URL);

/**
 * node-postgres parses a `date` column into a JS Date using LOCAL time
 * (`new Date(year, month, day)` -- see postgres-date's getDate(), which says
 * so explicitly), not UTC. Every consumer of weddingDate (formatWeddingDate,
 * the homepage countdown script) expects the same 'YYYY-MM-DD' string the
 * in-memory store uses; left unconverted, interpolating the Date produces
 * "NaN" in the countdown and a raw Date.toString() everywhere else. Reading
 * it back with the LOCAL getters (not toISOString(), which is UTC and would
 * shift the date backward whenever the server runs east of UTC) round-trips
 * exactly because the value was constructed from local components too.
 */
export function toIsoDateString(value) {
  if (!(value instanceof Date)) return value;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    paletteName: row.palette_name || '',
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    baseTextColor: row.base_text_color || '#2B2118',
    invertedTextColor: row.inverted_text_color || '#FFFFFF',
    surfaceColor: row.surface_color || '#FFFFFF',
    fontChoice: row.font_choice || '',
    fontFamily: row.font_family,
    fontStyle: row.font_style,
    heroImageUrl: row.hero_image_url || '',
    invitationTemplateUrl: row.invitation_template_url || '',
    invitationNameTop: row.invitation_name_top,
    invitationNameLeft: row.invitation_name_left,
    invitationNameFontSize: row.invitation_name_font_size,
    invitationNameColor: row.invitation_name_color,
    coupleNames: row.couple_names,
    weddingDate: toIsoDateString(row.wedding_date),
    weddingTime: row.wedding_time || '15:00',
    venueName: row.venue_name || '',
    venueAddress: row.venue_address || '',
    brideName: row.bride_name || '',
    bridePhotoUrl: row.bride_photo_url || '',
    brideBio: row.bride_bio || '',
    groomName: row.groom_name || '',
    groomPhotoUrl: row.groom_photo_url || '',
    groomBio: row.groom_bio || '',
    invitationCodeSurnamePosition: row.invitation_code_surname_position || 'first',
    invitationCodeGroupPrefix: row.invitation_code_group_prefix === true,
  };
}

export async function getThemeSettings() {
  if (!useDb) {
    return { ...themeSettings };
  }

  const { rows } = await query('SELECT * FROM theme_settings LIMIT 1');
  return mapRow(rows[0]) || { ...themeSettings };
}

export async function updateThemeSettings(patch) {
  const current = await getThemeSettings();
  const { settings, errors } = mergeThemeUpdate(current, patch);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  if (!useDb) {
    Object.assign(themeSettings, settings);
    return { success: true, settings: { ...themeSettings } };
  }

  await query(
    `UPDATE theme_settings SET
      palette_name = $1, primary_color = $2, secondary_color = $3, accent_color = $4,
      font_choice = $5, font_family = $6, font_style = $7, hero_image_url = $8,
      invitation_template_url = $9, invitation_name_top = $10, invitation_name_left = $11,
      invitation_name_font_size = $12, invitation_name_color = $13,
      couple_names = $14, wedding_date = $15, wedding_time = $16, venue_name = $17, venue_address = $18,
      invitation_code_surname_position = $19, invitation_code_group_prefix = $20,
      base_text_color = $21, inverted_text_color = $22, surface_color = $23,
      bride_name = $24, bride_photo_url = $25, bride_bio = $26,
      groom_name = $27, groom_photo_url = $28, groom_bio = $29
    WHERE id = $30`,
    [
      settings.paletteName,
      settings.primaryColor,
      settings.secondaryColor,
      settings.accentColor,
      settings.fontChoice,
      settings.fontFamily,
      settings.fontStyle,
      settings.heroImageUrl,
      settings.invitationTemplateUrl,
      settings.invitationNameTop,
      settings.invitationNameLeft,
      settings.invitationNameFontSize,
      settings.invitationNameColor,
      settings.coupleNames,
      settings.weddingDate,
      settings.weddingTime,
      settings.venueName,
      settings.venueAddress,
      settings.invitationCodeSurnamePosition,
      settings.invitationCodeGroupPrefix,
      settings.baseTextColor,
      settings.invertedTextColor,
      settings.surfaceColor,
      settings.brideName,
      settings.bridePhotoUrl,
      settings.brideBio,
      settings.groomName,
      settings.groomPhotoUrl,
      settings.groomBio,
      settings.id,
    ]
  );

  return { success: true, settings: await getThemeSettings() };
}
