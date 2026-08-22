import { query } from '../db.js';
import { themeSettings } from '../data/themeStore.js';
import { mergeThemeUpdate } from './mergeThemeUpdate.js';

const useDb = Boolean(process.env.DATABASE_URL);

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    fontFamily: row.font_family,
    fontStyle: row.font_style,
    heroImageUrl: row.hero_image_url || '',
    invitationTemplateUrl: row.invitation_template_url || '',
    invitationNameTop: row.invitation_name_top,
    invitationNameLeft: row.invitation_name_left,
    invitationNameFontSize: row.invitation_name_font_size,
    invitationNameColor: row.invitation_name_color,
    coupleNames: row.couple_names,
    weddingDate: row.wedding_date,
    venueName: row.venue_name || '',
    venueAddress: row.venue_address || '',
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
      primary_color = $1, secondary_color = $2, accent_color = $3,
      font_family = $4, font_style = $5, hero_image_url = $6,
      invitation_template_url = $7, invitation_name_top = $8, invitation_name_left = $9,
      invitation_name_font_size = $10, invitation_name_color = $11,
      couple_names = $12, wedding_date = $13, venue_name = $14, venue_address = $15
    WHERE id = $16`,
    [
      settings.primaryColor,
      settings.secondaryColor,
      settings.accentColor,
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
      settings.venueName,
      settings.venueAddress,
      settings.id,
    ]
  );

  return { success: true, settings: await getThemeSettings() };
}
