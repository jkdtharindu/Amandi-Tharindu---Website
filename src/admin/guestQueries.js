/**
 * Pure helpers behind the admin guest list and RSVP dashboard
 * (PRD P0-07 filtering/search, P0-08 stats and CSV export).
 *
 * These take plain arrays so they can be unit tested without a database and
 * reused against either the `pg` rows or the in-memory prototype store.
 */

const CSV_COLUMNS = [
  'Code',
  'Name',
  'Relationship',
  'Slot Count',
  'RSVP Status',
  'WhatsApp Number',
  'Participant Names',
];

/** Filters out soft-deleted guests, then applies status/relationship/search. */
export function filterGuests(guests = [], filters = {}) {
  const { status, relationship, search } = filters;

  const needle = String(search ?? '').trim().toLowerCase();
  const wantStatus = status && status !== 'all' ? String(status) : null;
  const wantRelationship =
    relationship && relationship !== 'all' ? String(relationship) : null;

  return guests.filter((guest) => {
    if (guest.isDeleted) return false;
    if (wantStatus && guest.rsvpStatus !== wantStatus) return false;
    if (wantRelationship && guest.relationship !== wantRelationship) return false;

    if (needle) {
      const haystack = `${guest.name ?? ''} ${guest.code ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

/**
 * Headline RSVP numbers for the dashboard.
 *
 * `accepted` counts guest records (families/invitations); `acceptedHeadcount`
 * counts the individual participants they named.
 */
export function computeRsvpStats(guests = [], responses = []) {
  const active = guests.filter((guest) => !guest.isDeleted);
  const activeIds = new Set(active.map((guest) => guest.id));

  const countByStatus = (status) =>
    active.filter((guest) => guest.rsvpStatus === status).length;

  const acceptedHeadcount = responses.reduce((total, response) => {
    if (!activeIds.has(response.guestId)) return total;
    if (!response.attending) return total;
    return total + (response.participantNames?.length ?? 0);
  }, 0);

  return {
    totalInvited: active.length,
    accepted: countByStatus('accepted'),
    acceptedHeadcount,
    declined: countByStatus('declined'),
    pending: countByStatus('pending'),
  };
}

/**
 * One row per invitation code for the dashboard table: how many people were
 * invited, and how many of them accepted, declined or have not replied.
 * A party with named people is counted person by person (so "half declined"
 * shows correctly); an older headcount-only party is counted by its party
 * status, using its seat count (or the people on its accepted response).
 */
export function computeCodeBreakdown(guests = [], responses = [], invitees = []) {
  const responseByGuestId = new Map(responses.map((response) => [response.guestId, response]));

  const rows = guests
    .filter((guest) => !guest.isDeleted)
    .map((guest) => {
      const people = invitees.filter(
        (invitee) => invitee.guestId === guest.id && invitee.approvalStatus === 'approved',
      );
      let accepted = 0;
      let declined = 0;
      let pending = 0;
      let invited;

      if (people.length > 0) {
        invited = people.length;
        accepted = people.filter((person) => person.rsvpStatus === 'accepted').length;
        declined = people.filter((person) => person.rsvpStatus === 'declined').length;
        pending = invited - accepted - declined;
      } else {
        invited = guest.slotCount ?? 0;
        if (guest.rsvpStatus === 'accepted') {
          const response = responseByGuestId.get(guest.id);
          accepted = Math.min(invited, response?.participantNames?.length || invited);
          pending = invited - accepted;
        } else if (guest.rsvpStatus === 'declined') {
          declined = invited;
        } else {
          pending = invited;
        }
      }

      return { code: guest.code, name: guest.name, invited, accepted, declined, pending };
    });

  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);

  return {
    rows,
    totals: {
      codes: rows.length,
      invited: sum('invited'),
      accepted: sum('accepted'),
      declined: sum('declined'),
      pending: sum('pending'),
      // Codes with no accepted person yet that are not fully declined: same
      // rule as a party's own status, so it matches "Awaiting reply" above.
      codesPending: rows.filter((row) => row.accepted === 0 && row.declined < row.invited).length,
    },
  };
}

// A leading =, @, tab or CR makes a spreadsheet treat the cell as a formula.
const FORMULA_LEAD = /^[=@\t\r]/;
// So does a leading + or -, unless what follows is just a number (e.g. "+94...").
const SIGN_NOT_NUMERIC = /^[+-](?![\d\s.,]*$)/;

function escapeCsvField(value) {
  const raw = value === null || value === undefined ? '' : String(value);

  // Guest-supplied fields (participant names, WhatsApp numbers) end up in a
  // file the admin opens in Excel, so neutralise formula injection first.
  const safe =
    FORMULA_LEAD.test(raw) || SIGN_NOT_NUMERIC.test(raw) ? `'${raw}` : raw;

  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Renders the given guests as CSV, one row each, with their participants. */
export function guestsToCsv(guests = [], responses = []) {
  const responseByGuestId = new Map(
    responses.map((response) => [response.guestId, response])
  );

  const rows = guests.map((guest) => {
    const response = responseByGuestId.get(guest.id);
    return [
      guest.code,
      guest.name,
      guest.relationship,
      guest.slotCount,
      guest.rsvpStatus,
      guest.whatsappNumber,
      (response?.participantNames ?? []).join(', '),
    ]
      .map(escapeCsvField)
      .join(',');
  });

  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}
