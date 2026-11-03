// "Add to calendar" for the wedding: a Google Calendar link and a .ics file that
// opens in Apple Calendar, Outlook and most other calendar apps. The ceremony time
// is Sri Lanka time (+05:30), so every guest gets the same real moment.

export const DEFAULT_DURATION_HOURS = 4;

/** 20261214T093000Z — the compact UTC form both Google and .ics accept. */
function compactUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escapes a value for an .ics text field. */
function icsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * @param {{ title: string, date: string, time?: string, venueName?: string, venueAddress?: string, durationHours?: number }} input
 *   `date` is YYYY-MM-DD and `time` is HH:MM, both as set in the Theme editor.
 * @returns {{ googleUrl: string, ics: string } | null} null when there is no usable date.
 */
export function buildCalendarEvent({ title, date, time = '00:00', venueName = '', venueAddress = '', durationHours = DEFAULT_DURATION_HOURS }) {
  const start = new Date(`${date}T${time || '00:00'}:00+05:30`);
  if (!date || Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  const location = [venueName, venueAddress].filter(Boolean).join(', ');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${compactUtc(start)}/${compactUtc(end)}`,
  });
  if (location) params.set('location', location);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding website//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:wedding-${compactUtc(start)}@wedding-website`,
    `DTSTAMP:${compactUtc(new Date())}`,
    `DTSTART:${compactUtc(start)}`,
    `DTEND:${compactUtc(end)}`,
    `SUMMARY:${icsText(title)}`,
    ...(location ? [`LOCATION:${icsText(location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return {
    googleUrl: `https://calendar.google.com/calendar/render?${params.toString()}`,
    ics: lines.join('\r\n') + '\r\n',
  };
}
