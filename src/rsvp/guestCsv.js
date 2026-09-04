/**
 * Guest list CSV export for the admin dashboard (P0-08).
 *
 * Written to RFC 4180 quoting rules, with one addition: values are neutralised
 * against spreadsheet formula injection before quoting.
 */

const COLUMNS = [
  'Name',
  'Code',
  'Relationship',
  'Slots',
  'RSVP Status',
  'Headcount',
  'Participant Names',
  'WhatsApp',
  'Email',
  'Deleted',
];

/**
 * Excel, LibreOffice and Google Sheets evaluate a cell whose text begins with
 * = + - or @ (and treat a leading tab/CR as a lead-in to the same). Guest names
 * are admin-entered free text, so exporting one verbatim would turn the couple's
 * own guest list into a live formula on their machine. Prefixing with a single
 * quote makes the sheet render it as literal text.
 */
function neutralise(value) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Quotes a field if it holds a comma, quote or newline; doubles inner quotes. */
function escapeCsvValue(raw) {
  const value = neutralise(String(raw ?? ''));
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toRow(values) {
  return values.map(escapeCsvValue).join(',');
}

export function buildGuestCsv(guests = [], responses = []) {
  const responseByGuest = new Map((responses || []).map((response) => [response.guestId, response]));

  const rows = (guests || []).map((guest) => {
    const response = responseByGuest.get(guest.id);
    const names = response && Array.isArray(response.participantNames) ? response.participantNames : [];

    let status = 'pending';
    if (response) status = response.attending ? 'accepted' : 'declined';

    // Mirrors the headcount rule in rsvpStats.js: an acceptance is at least one
    // head even when no names were captured.
    const headcount = status === 'accepted' ? Math.max(names.length, 1) : 0;

    return toRow([
      guest.name,
      guest.code,
      guest.relationship,
      guest.slotCount,
      status,
      headcount,
      names.join(', '),
      guest.whatsappNumber || '',
      guest.email || '',
      guest.isDeleted ? 'yes' : 'no',
    ]);
  });

  // Deleted guests are kept in the export, flagged, so the file reconciles
  // against the guest list rather than silently losing records.
  return [toRow(COLUMNS), ...rows].join('\n') + '\n';
}
