import { query } from '../db.js';
import { guestStore } from '../data/guestStore.js';
import { rsvpResponses } from '../data/rsvpStore.js';
import { mapGuestRow, mapResponseRow } from '../guest-auth/guestRepo.js';
import { generateGuestCode } from './generateGuestCode.js';

/**
 * Admin-side data access (PRD P0-07, P0-08).
 *
 * I/O only — all filtering, stats, and CSV shaping live in `guestQueries.js`
 * so they stay unit-testable without a database. Mirrors the `useDb` fallback
 * used by `guest-auth/guestRepo.js`: real Postgres when `DATABASE_URL` is set,
 * the in-memory prototype store otherwise.
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
 * Creates a guest, auto-generating a unique `[SURNAME]-[NNN]` code.
 *
 * @param {GuestInput} input
 */
export async function createGuest({ name, relationship, slotCount, whatsappNumber = null }) {
  const existing = await listAllGuests();
  // Soft-deleted guests keep their codes reserved, so pass every code.
  const code = generateGuestCode(name, existing.map((guest) => guest.code));

  if (!isDbEnabled()) {
    const guest = {
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
    return guest;
  }

  const { rows } = await query(
    `INSERT INTO guests (code, name, relationship, slot_count, whatsapp_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [code, name, relationship, slotCount, whatsappNumber]
  );
  return mapGuestRow(rows[0]);
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
 * Soft-deletes a guest: hidden from the guest-facing site, but the record and
 * its RSVP history are preserved (PRD §7 — guest soft delete).
 */
export async function softDeleteGuest(id) {
  if (!isDbEnabled()) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest) return null;
    guest.isDeleted = true;
    return guest;
  }

  const { rows } = await query(
    `UPDATE guests SET is_deleted = true WHERE id = $1 AND is_deleted = false RETURNING *`,
    [id]
  );
  return mapGuestRow(rows[0]);
}
