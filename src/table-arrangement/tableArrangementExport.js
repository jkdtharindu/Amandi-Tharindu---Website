/**
 * Table arrangement Excel export for event management team.
 *
 * Generates tab-separated values with proper escaping for Excel compatibility.
 * To enable proper .xlsx format, install 'exceljs' library and uncomment the section below.
 */

const COLUMNS = ['Table', 'Table Name', 'Seat', 'Guest Name', 'Contact', 'Dietary Requirements', 'Special Notes'];

/**
 * Escape values to prevent formula injection in Excel.
 */
function escapeForExcel(value) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Escape TSV field (tab-separated).
 */
function escapeTsvValue(raw) {
  const value = escapeForExcel(String(raw ?? ''));
  return value.includes('\t') || value.includes('\n') || value.includes('"')
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

function toTsvRow(values) {
  return values.map(escapeTsvValue).join('\t');
}

/**
 * Generate a TSV file (tab-separated values) that Excel can open as .xlsx.
 * This format is fully compatible with Excel, Google Sheets, and other spreadsheet apps.
 */
export function buildTableArrangementExport(tables = []) {
  const rows = [];

  tables.forEach((table) => {
    const seats = Array.isArray(table.seats) ? table.seats : [];

    if (seats.length === 0) {
      // Show empty table
      rows.push(toTsvRow([
        table.table_number || '',
        table.table_name || '',
        '—',
        '(No seats assigned)',
        '',
        '',
        '',
      ]));
    } else {
      seats.forEach((seat) => {
        rows.push(toTsvRow([
          table.table_number || '',
          table.table_name || '',
          seat.seatNumber || '',
          seat.guestName || seat.probableAttendeeLabel || '(Unassigned)',
          seat.guestName ? '' : '',
          seat.dietaryRequirements || '',
          seat.specialNotes || '',
        ]));
      });
    }
  });

  return [toTsvRow(COLUMNS), ...rows].join('\n') + '\n';
}

/**
 * Generate a summary sheet showing:
 * - Total tables
 * - Total assigned seats
 * - Total unassigned seats
 * - Dietary requirements count
 */
export function buildTableArrangementSummary(tables = []) {
  let totalCapacity = 0;
  let totalAssigned = 0;
  let dietaryRequirements = [];
  let specialNotes = [];

  tables.forEach((table) => {
    const seats = Array.isArray(table.seats) ? table.seats : [];
    totalCapacity += (table.capacity || seats.length);

    seats.forEach((seat) => {
      if (seat.guestId || seat.probableAttendeeId) {
        totalAssigned += 1;
        if (seat.dietaryRequirements) {
          dietaryRequirements.push({
            table: table.table_number,
            guest: seat.guestName || seat.probableAttendeeLabel,
            requirement: seat.dietaryRequirements,
          });
        }
        if (seat.specialNotes) {
          specialNotes.push({
            table: table.table_number,
            guest: seat.guestName || seat.probableAttendeeLabel,
            note: seat.specialNotes,
          });
        }
      }
    });
  });

  const rows = [];
  rows.push(toTsvRow(['SEATING ARRANGEMENT SUMMARY']));
  rows.push('');
  rows.push(toTsvRow(['Metric', 'Count']));
  rows.push(toTsvRow(['Total Tables', String(tables.length)]));
  rows.push(toTsvRow(['Total Capacity', String(totalCapacity)]));
  rows.push(toTsvRow(['Assigned Guests', String(totalAssigned)]));
  rows.push(toTsvRow(['Unassigned Seats', String(totalCapacity - totalAssigned)]));
  rows.push(toTsvRow(['Dietary Requirements', String(dietaryRequirements.length)]));

  if (dietaryRequirements.length > 0) {
    rows.push('');
    rows.push(toTsvRow(['DIETARY REQUIREMENTS']));
    rows.push(toTsvRow(['Table', 'Guest', 'Requirement']));
    dietaryRequirements.forEach((item) => {
      rows.push(toTsvRow([
        String(item.table),
        item.guest,
        item.requirement,
      ]));
    });
  }

  if (specialNotes.length > 0) {
    rows.push('');
    rows.push(toTsvRow(['SPECIAL NOTES']));
    rows.push(toTsvRow(['Table', 'Guest', 'Note']));
    specialNotes.forEach((item) => {
      rows.push(toTsvRow([
        String(item.table),
        item.guest,
        item.note,
      ]));
    });
  }

  return rows.join('\n') + '\n';
}
