const HEX_COLOR_FIELDS = ['primaryColor', 'secondaryColor', 'accentColor', 'invitationNameColor'];
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const THEME_FIELD_GROUPS = [
  {
    id: 'hero',
    label: 'Hero Image',
    fields: ['heroImageUrl'],
  },
  {
    id: 'invitation-template',
    label: 'Invitation Template',
    fields: [
      'invitationTemplateUrl',
      'invitationNameTop',
      'invitationNameLeft',
      'invitationNameFontSize',
      'invitationNameColor',
    ],
  },
  {
    id: 'colors',
    label: 'Colors',
    fields: ['primaryColor', 'secondaryColor', 'accentColor'],
  },
  {
    id: 'typography',
    label: 'Typography',
    fields: ['fontFamily', 'fontStyle'],
  },
  {
    id: 'wedding-info',
    label: 'Wedding Info',
    fields: ['coupleNames', 'weddingDate'],
  },
  {
    id: 'venue',
    label: 'Venue',
    fields: ['venueName', 'venueAddress'],
  },
];

const ALLOWED_FIELDS = THEME_FIELD_GROUPS.flatMap((group) => group.fields);

export function mergeThemeUpdate(current, patch) {
  const errors = [];
  const next = { ...current };

  for (const [key, rawValue] of Object.entries(patch || {})) {
    if (!ALLOWED_FIELDS.includes(key)) continue;

    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

    if (HEX_COLOR_FIELDS.includes(key) && value && !HEX_COLOR_PATTERN.test(value)) {
      errors.push({ field: key, reason: 'invalid_hex_color' });
      continue;
    }

    if (key === 'weddingDate' && value && !DATE_PATTERN.test(value)) {
      errors.push({ field: key, reason: 'invalid_date' });
      continue;
    }

    next[key] = value;
  }

  return { settings: next, errors };
}
