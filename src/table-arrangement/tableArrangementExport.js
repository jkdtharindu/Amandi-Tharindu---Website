/**
 * Table arrangement spreadsheet export for the event management team.
 *
 * Generates comma-separated values (a .csv file), which Excel and Google Sheets
 * open directly. It used to be tab-separated text named .xlsx, which Excel warns
 * about (Action 61, finding 3). The route adds a byte-order mark so Excel reads
 * the "—" and any Sinhala/Tamil names as UTF-8.
 *
 * Each row carries the table's number, name and side (Bride, Groom or Common —
 * Action 68). Numbers restart on each side, so "Table 1" alone no longer names
 * one table; the summary's dietary and notes lists use the table's name instead.
 */

import { sideLabel, tableLabel } from './tableSides.js';

const COLUMNS = ['Table', 'Table Name', 'Side', 'Seat', 'Guest Name', 'Contact', 'Dietary Requirements', 'Special Notes'];

/**
 * Escape values to prevent formula injection in Excel.
 */
function escapeForExcel(value) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Escape one CSV field: wrap it in quotes when it holds a comma, quote or line break.
 */
function escapeCsvValue(raw) {
  // A phone number such as +94771234567 starts with "+" but is plain digits, so it needs no
  // formula guard (which would print a stray apostrophe in front of it). Excel shows it without the "+".
  const isPhone = raw && typeof raw === 'object' && /^\+\d[\d ]{5,19}$/.test(raw.phone);
  const value = isPhone ? raw.phone : escapeForExcel(String(raw?.phone ?? raw ?? ''));
  return /[",\n\r\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsvRow(values) {
  return values.map(escapeCsvValue).join(',');
}

/**
 * A seat whose guest has since been removed is really free: show it as empty and
 * drop its notes, so a leftover seat is neither listed nor counted as assigned.
 */
function withoutRemovedOccupants(tables) {
  return tables.map((table) => ({
    ...table,
    seats: (Array.isArray(table.seats) ? table.seats : []).map((seat) =>
      seat.occupantRemoved
        ? {
            ...seat,
            guestId: null,
            guestName: null,
            inviteeId: null,
            inviteeName: null,
            probableAttendeeId: null,
            probableAttendeeLabel: null,
            dietaryRequirements: null,
            specialNotes: null,
          }
        : seat
    ),
  }));
}

function occupantName(seat) {
  const name = seat.guestName || seat.inviteeName || seat.probableAttendeeLabel;
  return name && seat.occupantRsvpStatus === 'declined' ? `${name} (Declined)` : name;
}

/**
 * Generate the per-seat CSV.
 *
 * `contactsByGuestId` maps a guest id to their WhatsApp number. The caller builds it
 * from the signed-in side's own guests only, so the other side's people at a Common
 * table show no number.
 */
export function buildTableArrangementExport(tables = [], { contactsByGuestId = {} } = {}) {
  const rows = [];

  withoutRemovedOccupants(tables).forEach((table) => {
    const seats = Array.isArray(table.seats) ? table.seats : [];

    if (seats.length === 0) {
      // Show empty table
      rows.push(toCsvRow([
        table.table_number || '',
        table.table_name || '',
        sideLabel(table.side),
        '—',
        '(No seats assigned)',
        '',
        '',
        '',
      ]));
    } else {
      seats.forEach((seat) => {
        rows.push(toCsvRow([
          table.table_number || '',
          table.table_name || '',
          sideLabel(table.side),
          seat.seatNumber || '',
          occupantName(seat) || '(Unassigned)',
          { phone: contactsByGuestId[seat.guestId || seat.inviteeGuestId] || '' },
          seat.dietaryRequirements || '',
          seat.specialNotes || '',
        ]));
      });
    }
  });

  return [toCsvRow(COLUMNS), ...rows].join('\n') + '\n';
}

/**
 * Generate a summary sheet showing:
 * - Total tables
 * - Total assigned seats
 * - Total unassigned seats
 * - Dietary requirements count
 */
export function buildTableArrangementSummary(rawTables = []) {
  const tables = withoutRemovedOccupants(rawTables);
  let totalCapacity = 0;
  let totalAssigned = 0;
  let dietaryRequirements = [];
  let specialNotes = [];

  tables.forEach((table) => {
    const seats = Array.isArray(table.seats) ? table.seats : [];
    totalCapacity += (table.capacity || seats.length);

    seats.forEach((seat) => {
      if (seat.guestId || seat.probableAttendeeId || seat.inviteeId) {
        totalAssigned += 1;
        if (seat.dietaryRequirements) {
          dietaryRequirements.push({
            table: tableLabel(table),
            guest: occupantName(seat),
            requirement: seat.dietaryRequirements,
          });
        }
        if (seat.specialNotes) {
          specialNotes.push({
            table: tableLabel(table),
            guest: occupantName(seat),
            note: seat.specialNotes,
          });
        }
      }
    });
  });

  const rows = [];
  rows.push(toCsvRow(['SEATING ARRANGEMENT SUMMARY']));
  rows.push('');
  rows.push(toCsvRow(['Metric', 'Count']));
  rows.push(toCsvRow(['Total Tables', String(tables.length)]));
  rows.push(toCsvRow(['Total Capacity', String(totalCapacity)]));
  rows.push(toCsvRow(['Assigned Guests', String(totalAssigned)]));
  rows.push(toCsvRow(['Unassigned Seats', String(totalCapacity - totalAssigned)]));
  rows.push(toCsvRow(['Dietary Requirements', String(dietaryRequirements.length)]));

  if (dietaryRequirements.length > 0) {
    rows.push('');
    rows.push(toCsvRow(['DIETARY REQUIREMENTS']));
    rows.push(toCsvRow(['Table', 'Guest', 'Requirement']));
    dietaryRequirements.forEach((item) => {
      rows.push(toCsvRow([
        String(item.table),
        item.guest,
        item.requirement,
      ]));
    });
  }

  if (specialNotes.length > 0) {
    rows.push('');
    rows.push(toCsvRow(['SPECIAL NOTES']));
    rows.push(toCsvRow(['Table', 'Guest', 'Note']));
    specialNotes.forEach((item) => {
      rows.push(toCsvRow([
        String(item.table),
        item.guest,
        item.note,
      ]));
    });
  }

  return rows.join('\n') + '\n';
}
