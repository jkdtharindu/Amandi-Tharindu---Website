import { query } from '../db.js';
import { guestStore } from '../data/guestStore.js';
import { rsvpResponses } from '../data/rsvpStore.js';
import { invitees } from '../data/inviteesStore.js';
import { mapGuestRow, mapResponseRow } from '../guest-auth/guestRepo.js';
import { generateGuestCode } from './generateGuestCode.js';
import { createInviteesForGuest } from '../invitees/inviteesRepo.js';

/**
 * Admin-side data access (PRD P0-07, P0-08, P1-14D).
 *
 * I/O only — all filtering, stats, and CSV shaping live in `guestQueries.js`
 * so they stay unit-testable without a database. Mirrors the `useDb` fallback
 * used by `guest-auth/guestRepo.js`: real Postgres when `DATABASE_URL` is set,
 * the in-memory prototype store otherwise.
 *
 * Updated 2026-09-20: Added party-aware functions for multi-admin support (P1-14D).
 * All guest operations now respect `assigned_to_party` field.
 */

const isDbEnabled = () => Boolean(process.env.DATABASE_URL);

/** Every guest, including soft-deleted ones (callers decide what to hide). */
export async function listAllGuests() {
  if (!isDbEnabled()) return [...guestStore];

  const { rows } = await query('SELECT * FROM guests ORDER BY created_at DESC, code');
  return rows.map(mapGuestRow);
}

export async function listAllRsvpResponses() {
  if (!isDbEnabled()) return [...rsvpResponses];

  const { rows } = await query('SELECT * FROM rsvp_responses');
  return rows.map(mapResponseRow);
}

/**
 * @typedef {object} GuestInput
 * @property {string} name
 * @property {string} relationship
 * @property {number} slotCount
 * @property {string|null} [whatsappNumber]
 */

/**
 * Creates a guest, auto-generating a unique `[CATEGORY]-[FIRST_NAME]-[RANDOM]` code.
 *
 * @param {GuestInput} input
 */
export async function createGuest({ name, relationship, slotCount, whatsappNumber = null, inviteeNames }) {
  const existing = await listAllGuests();
  // Soft-deleted guests keep their codes reserved, so pass every code.
  const code = generateGuestCode(name, relationship, existing.map((guest) => guest.code));

  let guest;
  if (!isDbEnabled()) {
    guest = {
      id: `guest-${Date.now()}-${guestStore.length + 1}`,
      code,
      name,
      relationship,
      slotCount,
      whatsappNumber,
      email: null,
      hasVisited: false,
      rsvpStatus: 'pending',
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };
    guestStore.push(guest);
  } else {
    const { rows } = await query(
      `INSERT INTO guests (code, name, relationship, slot_count, whatsapp_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [code, name, relationship, slotCount, whatsappNumber]
    );
    guest = mapGuestRow(rows[0]);
  }

  // Admin named each person up front -- create their individual invitee rows
  // now, in the same request, so the party is never left half-set-up.
  if (inviteeNames && inviteeNames.length > 0) {
    await createInviteesForGuest(guest.id, inviteeNames, { addedBy: 'admin', approvalStatus: 'approved' });
  }

  return guest;
}

/**
 * Updates the admin-editable fields of a guest. The invitation code is
 * immutable: it is printed on physical wedding cards.
 *
 * @param {string} id
 * @param {GuestInput} input
 */
export async function updateGuest(id, { name, relationship, slotCount, whatsappNumber = null }) {
  if (!isDbEnabled()) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest) return null;
    Object.assign(guest, { name, relationship, slotCount, whatsappNumber });
    return guest;
  }

  const { rows } = await query(
    `UPDATE guests
        SET name = $1, relationship = $2, slot_count = $3, whatsapp_number = $4
      WHERE id = $5 AND is_deleted = false
      RETURNING *`,
    [name, relationship, slotCount, whatsappNumber, id]
  );
  return mapGuestRow(rows[0]);
}

/**
 * Bumps a guest's stored headcount by one -- called when an admin approves a
 * guest's own "add another person" request, so slot_count (read by CSV
 * export, the guest list, and WhatsApp templates) stays accurate without
 * those readers needing to switch to counting invitee rows themselves.
 * `exec` (optional) is the open transaction's query function; see approveInviteeRequest.js.
 */
export async function incrementGuestSlotCount(id, exec) {
  const run = exec ?? (isDbEnabled() ? query : null);
  if (!run) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest) return null;
    guest.slotCount = (guest.slotCount || 0) + 1;
    return guest;
  }

  const { rows } = await run(
    `UPDATE guests SET slot_count = slot_count + 1 WHERE id = $1 RETURNING *`,
    [id]
  );
  return mapGuestRow(rows[0]);
}

/**
 * Recomputes a guest's stored headcount from the ground truth — how many of
 * their invitees are still approved — rather than incrementing/decrementing
 * a counter that can drift (the edit form also lets slot_count be typed
 * directly, so a relative -1 on delete could compound an existing mismatch).
 * Called after an admin removes one named person from the party.
 * `exec` (optional) is the open transaction's query function; see removeInvitee.js.
 */
export async function syncGuestSlotCountToInvitees(id, exec) {
  const run = exec ?? (isDbEnabled() ? query : null);
  if (!run) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest) return null;
    guest.slotCount = invitees.filter(
      (entry) => entry.guestId === id && entry.approvalStatus === 'approved'
    ).length;
    return guest;
  }

  const { rows } = await run(
    `UPDATE guests SET slot_count = (
       SELECT COUNT(*)::int FROM invitees WHERE guest_id = $1 AND approval_status = 'approved'
     ) WHERE id = $1 RETURNING *`,
    [id]
  );
  return mapGuestRow(rows[0]);
}

/**
 * Soft-deletes a guest: hidden from the guest-facing site, but the record and
 * its RSVP history are preserved (PRD §7 — guest soft delete). This only marks
 * the guest; freeing their table seats is removeGuest.js's job, in the same
 * transaction. `exec` (optional) is the open transaction's query function.
 */
export async function softDeleteGuest(id, exec) {
  const run = exec ?? (isDbEnabled() ? query : null);
  if (!run) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest) return null;
    guest.isDeleted = true;
    return guest;
  }

  const { rows } = await run(
    `UPDATE guests SET is_deleted = true WHERE id = $1 AND is_deleted = false RETURNING *`,
    [id]
  );
  return mapGuestRow(rows[0]);
}

/**
 * PARTY-AWARE FUNCTIONS (2026-09-20, P1-14B, P1-14D)
 * All functions below support multi-admin: they filter by assigned_to_party.
 */

/** List guests for a specific party (bride or groom). Excludes soft-deleted guests. */
export async function listGuestsByParty(party) {
  if (!isDbEnabled()) {
    return guestStore
      .filter((g) => (g.assignedToParty ?? 'bride') === party && !g.isDeleted)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const { rows } = await query(
    `SELECT * FROM guests WHERE assigned_to_party = $1 AND is_deleted = false ORDER BY created_at DESC, code`,
    [party]
  );
  return rows.map(mapGuestRow);
}

/** Get stats for a specific party: invited, accepted, declined, pending. */
export async function getPartyStats(party) {
  if (!isDbEnabled()) {
    const guests = guestStore.filter((g) => (g.assignedToParty ?? 'bride') === party && !g.isDeleted);
    const invited = guests.length;
    const accepted = guests.filter((g) => g.rsvpStatus === 'accepted').length;
    const declined = guests.filter((g) => g.rsvpStatus === 'declined').length;
    const pending = guests.filter((g) => g.rsvpStatus === 'pending').length;

    return { invited, accepted, declined, pending };
  }

  const { rows } = await query(
    `SELECT rsvp_status, COUNT(*) as count
     FROM guests
     WHERE assigned_to_party = $1 AND is_deleted = false
     GROUP BY rsvp_status`,
    [party]
  );

  const stats = { invited: 0, accepted: 0, declined: 0, pending: 0 };
  for (const row of rows) {
    if (row.rsvp_status === 'accepted') stats.accepted = parseInt(row.count, 10);
    if (row.rsvp_status === 'declined') stats.declined = parseInt(row.count, 10);
    if (row.rsvp_status === 'pending') stats.pending = parseInt(row.count, 10);
  }
  stats.invited = stats.accepted + stats.declined + stats.pending;

  return stats;
}

/** Get a guest only if they belong to the requesting party. Returns null otherwise. */
export async function getGuestIfPartyOwner(id, party) {
  if (!isDbEnabled()) {
    const guest = guestStore.find((g) => g.id === id);
    if (!guest || (guest.assignedToParty ?? 'bride') !== party) return null;
    return guest;
  }

  const { rows } = await query(
    `SELECT * FROM guests WHERE id = $1 AND assigned_to_party = $2`,
    [id, party]
  );
  return rows.length > 0 ? mapGuestRow(rows[0]) : null;
}

/** Create a guest assigned to a specific party. */
export async function createGuestForParty(party, { name, relationship, slotCount, whatsappNumber = null, inviteeNames }) {
  const existing = await listAllGuests();
  const code = generateGuestCode(name, relationship, existing.map((guest) => guest.code));

  let guest;
  if (!isDbEnabled()) {
    guest = {
      id: `guest-${Date.now()}-${guestStore.length + 1}`,
      code,
      name,
      relationship,
      slotCount,
      assignedToParty: party,
      whatsappNumber,
      email: null,
      hasVisited: false,
      rsvpStatus: 'pending',
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };
    guestStore.push(guest);
  } else {
    const { rows } = await query(
      `INSERT INTO guests (code, name, relationship, slot_count, assigned_to_party, whatsapp_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [code, name, relationship, slotCount, party, whatsappNumber]
    );
    guest = mapGuestRow(rows[0]);
  }

  if (inviteeNames && inviteeNames.length > 0) {
    await createInviteesForGuest(guest.id, inviteeNames, { addedBy: 'admin', approvalStatus: 'approved' });
  }

  return guest;
}

/** Update a guest only if they belong to the requesting party. */
export async function updateGuestIfPartyOwner(id, party, { name, relationship, slotCount, whatsappNumber = null }) {
  if (!isDbEnabled()) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest || (guest.assignedToParty ?? 'bride') !== party) return null;
    Object.assign(guest, { name, relationship, slotCount, whatsappNumber });
    return guest;
  }

  const { rows } = await query(
    `UPDATE guests
     SET name = $1, relationship = $2, slot_count = $3, whatsapp_number = $4
     WHERE id = $5 AND assigned_to_party = $6 AND is_deleted = false
     RETURNING *`,
    [name, relationship, slotCount, whatsappNumber, id, party]
  );
  return rows.length > 0 ? mapGuestRow(rows[0]) : null;
}

/** Soft-delete a guest only if they belong to the requesting party. */
export async function softDeleteGuestIfPartyOwner(id, party, exec) {
  const run = exec ?? (isDbEnabled() ? query : null);
  if (!run) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest || (guest.assignedToParty ?? 'bride') !== party) return null;
    guest.isDeleted = true;
    return guest;
  }

  const { rows } = await run(
    `UPDATE guests SET is_deleted = true WHERE id = $1 AND assigned_to_party = $2 AND is_deleted = false RETURNING *`,
    [id, party]
  );
  return rows.length > 0 ? mapGuestRow(rows[0]) : null;
}

/**
 * MESSAGE EVENT TRACKING (2026-09-20, P1-14G)
 * Track which message events have been sent to each guest.
 */

/** Record a message event as sent/completed. */
export async function recordMessageEvent(guestId, eventName, party) {
  if (!isDbEnabled()) {
    // In-memory: store in an array (not persisted; in production this is DB-backed)
    return { guestId, eventName, party, isCompleted: true };
  }

  const { rows } = await query(
    `INSERT INTO message_events (guest_id, event_name, sent_by_party, is_completed)
     VALUES ($1, $2, $3, true)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [guestId, eventName, party]
  );
  return rows.length > 0 ? rows[0] : null;
}

/** Get message events for a guest. */
export async function getMessageEventsForGuest(guestId) {
  if (!isDbEnabled()) return [];

  const { rows } = await query(
    `SELECT event_name, is_completed, sent_at FROM message_events WHERE guest_id = $1 ORDER BY sent_at`,
    [guestId]
  );
  return rows;
}

/** Get pending message events for a party (guests without completed message events). */
export async function getPendingMessageEventsByParty(party) {
  if (!isDbEnabled()) return [];

  const { rows } = await query(
    `SELECT DISTINCT g.id, g.name, g.code, COUNT(me.id) as pending_event_count
     FROM guests g
     LEFT JOIN message_events me ON g.id = me.guest_id AND me.is_completed = false
     WHERE g.assigned_to_party = $1 AND g.is_deleted = false AND me.id IS NOT NULL
     GROUP BY g.id, g.name, g.code
     ORDER BY g.created_at DESC`,
    [party]
  );
  return rows;
}
