const HEX_COLOR_FIELDS = ['primaryColor', 'secondaryColor', 'accentColor', 'invitationNameColor'];
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Human-readable labels and hints for the admin form. The couple edits these
 * fields, so the UI must never expose raw property names.
 */
export const FIELD_LABELS = {
  heroImageUrl: { label: 'Hero image link', hint: 'Web address of the large photo on the home page' },
  invitationTemplateUrl: { label: 'Invitation card image link', hint: 'Web address of the invitation design' },
  invitationNameTop: { label: 'Guest name — distance from top', hint: 'For example 45%' },
  invitationNameLeft: { label: 'Guest name — distance from left', hint: 'For example 50%' },
  invitationNameFontSize: { label: 'Guest name — text size', hint: 'For example 2rem' },
  invitationNameColor: { label: 'Guest name — colour', hint: 'Hex colour, for example #5C3317' },
  primaryColor: { label: 'Main colour', hint: 'Used for buttons and highlights' },
  secondaryColor: { label: 'Background tint', hint: 'Soft background shade' },
  accentColor: { label: 'Accent colour', hint: 'Used for small highlights' },
  fontFamily: { label: 'Heading font', hint: 'For example Cormorant Garamond' },
  fontStyle: { label: 'Heading style', hint: 'normal or italic' },
  coupleNames: { label: 'Couple names', hint: 'Shown in the header and footer' },
  weddingDate: { label: 'Wedding date', hint: 'YYYY-MM-DD — also drives the countdown' },
  venueName: { label: 'Venue name', hint: '' },
  venueAddress: { label: 'Venue address', hint: '' },
};

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
