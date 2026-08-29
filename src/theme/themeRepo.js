import { query } from '../db.js';
import { themeSettings } from '../data/themeStore.js';
import { mergeThemeUpdate } from './mergeThemeUpdate.js';

const useDb = Boolean(process.env.DATABASE_URL);

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    paletteName: row.palette_name || '',
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
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
    weddingDate: row.wedding_date,
    venueName: row.venue_name || '',
    venueAddress: row.venue_address || '',
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
      couple_names = $14, wedding_date = $15, venue_name = $16, venue_address = $17,
      invitation_code_surname_position = $18, invitation_code_group_prefix = $19
    WHERE id = $20`,
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
      settings.venueName,
      settings.venueAddress,
      settings.invitationCodeSurnamePosition,
      settings.invitationCodeGroupPrefix,
      settings.id,
    ]
  );

  return { success: true, settings: await getThemeSettings() };
}
