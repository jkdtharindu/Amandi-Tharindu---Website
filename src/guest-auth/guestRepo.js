import crypto from 'node:crypto';
import { query } from '../db.js';
import { guestStore } from '../data/guestStore.js';
import { rsvpResponses } from '../data/rsvpStore.js';
import { generateInvitationCode, validateManualCode } from './generateInvitationCode.js';
import { validateGuestInput } from './validateGuestInput.js';

const useDb = Boolean(process.env.DATABASE_URL);

export function mapGuestRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    relationship: row.relationship,
    slotCount: row.slot_count,
    whatsappNumber: row.whatsapp_number,
    email: row.email,
    hasVisited: row.has_visited,
    rsvpStatus: row.rsvp_status,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
  };
}

export function mapResponseRow(row) {
  if (!row) return null;
  return {
    guestId: row.guest_id,
    attending: row.attending,
    participantNames: row.participant_names || [],
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

export async function findGuestByCode(code) {
  if (!useDb) {
    return guestStore.find((entry) => entry.code === code && entry.isDeleted !== true) || null;
  }

  const { rows } = await query('SELECT * FROM guests WHERE code = $1 AND is_deleted = false', [code]);
  return mapGuestRow(rows[0]);
}

export async function findGuestById(id) {
  if (!useDb) {
    return guestStore.find((entry) => entry.id === id && entry.isDeleted !== true) || null;
  }

  const { rows } = await query('SELECT * FROM guests WHERE id = $1 AND is_deleted = false', [id]);
  return mapGuestRow(rows[0]);
}

export async function findGuestByName(name) {
  if (!useDb) {
    const needle = String(name).trim().toLowerCase();
    return (
      guestStore.find(
        (g) => String(g.name).toLowerCase() === needle && g.isDeleted !== true
      ) || null
    );
  }

  const needle = String(name).trim().toLowerCase();
  const { rows } = await query(
    `SELECT * FROM guests WHERE LOWER(name) = $1 AND is_deleted = false LIMIT 1`,
    [needle]
  );
  return mapGuestRow(rows[0]);
}

export async function findGuestCandidatesByName(name) {
  if (!useDb) {
    const needle = String(name).trim().toLowerCase();
    return guestStore
      .filter(
        (g) => String(g.name).toLowerCase().includes(needle) && g.isDeleted !== true
      )
      .map((g) => ({ id: g.id, code: g.code, name: g.name }));
  }

  const needle = `%${String(name).trim().toLowerCase()}%`;
  const { rows } = await query(
    `SELECT id, code, name FROM guests WHERE LOWER(name) LIKE $1 AND is_deleted = false`,
    [needle]
  );
  return rows;
}

export async function findRsvpResponseByGuestId(guestId) {
  if (!useDb) {
    return rsvpResponses.find((entry) => entry.guestId === guestId) || null;
  }

  const { rows } = await query('SELECT * FROM rsvp_responses WHERE guest_id = $1 LIMIT 1', [guestId]);
  return mapResponseRow(rows[0]);
}

export async function updateGuestRsvpStatus(guestId, status) {
  if (!useDb) {
    const guest = guestStore.find((entry) => entry.id === guestId);
    if (guest) {
      guest.rsvpStatus = status;
    }
    return;
  }

  await query('UPDATE guests SET rsvp_status = $1 WHERE id = $2', [status, guestId]);
}

export async function upsertRsvpResponse(guestId, attending, participantNames = []) {
  if (!useDb) {
    const existing = rsvpResponses.find((entry) => entry.guestId === guestId);
    const timestamp = new Date().toISOString();

    if (existing) {
      existing.attending = attending;
      existing.participantNames = participantNames;
      existing.updatedAt = timestamp;
      return existing;
    }

    const newResponse = {
      guestId,
      attending,
      participantNames,
      submittedAt: timestamp,
      updatedAt: timestamp,
    };
    rsvpResponses.push(newResponse);
    return newResponse;
  }

  const { rows } = await query('SELECT id FROM rsvp_responses WHERE guest_id = $1 LIMIT 1', [guestId]);
  if (rows[0]) {
    await query(
      'UPDATE rsvp_responses SET attending = $1, participant_names = $2, updated_at = now() WHERE guest_id = $3',
      [attending, participantNames, guestId]
    );
  } else {
    await query(
      'INSERT INTO rsvp_responses (guest_id, attending, participant_names) VALUES ($1, $2, $3)',
      [guestId, attending, participantNames]
    );
  }

  return findRsvpResponseByGuestId(guestId);
}

function listAllGuestCodes() {
  return guestStore.map((guest) => guest.code);
}

function matchesGuestFilters(guest, { rsvpStatus, relationship, search }) {
  if (rsvpStatus && guest.rsvpStatus !== rsvpStatus) return false;
  if (relationship && guest.relationship !== relationship) return false;

  if (search) {
    const needle = String(search).trim().toLowerCase();
    const haystack = `${guest.name} ${guest.code}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

export async function listGuestsForAdmin(filters = {}) {
  if (!useDb) {
    return guestStore
      .filter((guest) => matchesGuestFilters(guest, filters))
      .map((guest) => ({
        ...guest,
        updatedAt: guest.updatedAt || guest.createdAt || null,
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  const conditions = [];
  const params = [];

  if (filters.rsvpStatus) {
    params.push(filters.rsvpStatus);
    conditions.push(`g.rsvp_status = $${params.length}`);
  }

  if (filters.relationship) {
    params.push(filters.relationship);
    conditions.push(`g.relationship = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(LOWER(g.name) LIKE $${params.length} OR LOWER(g.code) LIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT g.* FROM guests g ${whereClause} ORDER BY g.name ASC`,
    params
  );
  return rows.map(mapGuestRow);
}

/**
 * Resolves the code for a new or edited guest.
 *
 * An admin-supplied code always wins — it is the escape hatch for any name the
 * automatic rule reads wrongly, which the variety of Sri Lankan naming
 * conventions guarantees will happen. Otherwise a code is generated in the
 * configured format. Uniqueness is checked against every code on record,
 * including soft-deleted guests, because their card may already be printed.
 */
function resolveGuestCode({ requestedCode, name, relationship, existingCodes, codeFormat, ownCode = null }) {
  const taken = new Set(existingCodes.map((code) => String(code).toUpperCase()));
  if (ownCode) taken.delete(String(ownCode).toUpperCase());

  if (requestedCode !== undefined && String(requestedCode).trim() !== '') {
    const manual = validateManualCode(requestedCode);
    if (!manual.success) {
      return { success: false, errors: [{ field: 'code', reason: manual.reason }] };
    }
    if (taken.has(manual.code)) {
      return { success: false, errors: [{ field: 'code', reason: 'code_taken' }] };
    }
    return { success: true, code: manual.code };
  }

  return {
    success: true,
    code: generateInvitationCode(name, [...taken], { ...codeFormat, relationship }),
  };
}

export async function createGuest(input, codeFormat = {}) {
  const result = validateGuestInput(input);
  if (!result.success) return result;

  const timestamp = new Date().toISOString();

  if (!useDb) {
    const codeResult = resolveGuestCode({
      requestedCode: input.code,
      name: result.guest.name,
      relationship: result.guest.relationship,
      existingCodes: listAllGuestCodes(),
      codeFormat,
    });
    if (!codeResult.success) return codeResult;

    const guest = {
      id: crypto.randomUUID(),
      code: codeResult.code,
      name: result.guest.name,
      relationship: result.guest.relationship,
      slotCount: result.guest.slotCount,
      whatsappNumber: null,
      email: null,
      hasVisited: false,
      rsvpStatus: 'pending',
      isDeleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    guestStore.push(guest);
    return { success: true, guest };
  }

  const { rows: codeRows } = await query('SELECT code FROM guests');
  const codeResult = resolveGuestCode({
    requestedCode: input.code,
    name: result.guest.name,
    relationship: result.guest.relationship,
    existingCodes: codeRows.map((row) => row.code),
    codeFormat,
  });
  if (!codeResult.success) return codeResult;

  const { rows } = await query(
    `INSERT INTO guests (code, name, relationship, slot_count)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [codeResult.code, result.guest.name, result.guest.relationship, result.guest.slotCount]
  );
  return { success: true, guest: mapGuestRow(rows[0]) };
}

export async function updateGuest(id, patch) {
  const result = validateGuestInput(patch, { partial: true });
  if (!result.success) return result;

  // A code may be corrected while cards are unprinted. It is never regenerated
  // from a name change on its own — an existing code may already be on a card,
  // so replacing it has to be an explicit act.
  const wantsCodeChange = patch.code !== undefined && String(patch.code).trim() !== '';

  if (!useDb) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest) return { success: false, reason: 'guest_not_found' };

    if (wantsCodeChange) {
      const codeResult = resolveGuestCode({
        requestedCode: patch.code,
        name: guest.name,
        relationship: guest.relationship,
        existingCodes: listAllGuestCodes(),
        ownCode: guest.code,
      });
      if (!codeResult.success) return codeResult;
      guest.code = codeResult.code;
    }

    if (result.guest.name !== undefined) guest.name = result.guest.name;
    if (result.guest.relationship !== undefined) guest.relationship = result.guest.relationship;
    if (result.guest.slotCount !== undefined) guest.slotCount = result.guest.slotCount;
    guest.updatedAt = new Date().toISOString();

    return { success: true, guest: { ...guest } };
  }

  const { rows: existingRows } = await query('SELECT * FROM guests WHERE id = $1', [id]);
  if (!existingRows[0]) return { success: false, reason: 'guest_not_found' };

  const current = mapGuestRow(existingRows[0]);
  let code = current.code;

  if (wantsCodeChange) {
    const { rows: codeRows } = await query('SELECT code FROM guests');
    const codeResult = resolveGuestCode({
      requestedCode: patch.code,
      name: current.name,
      relationship: current.relationship,
      existingCodes: codeRows.map((row) => row.code),
      ownCode: current.code,
    });
    if (!codeResult.success) return codeResult;
    code = codeResult.code;
  }

  const next = {
    name: result.guest.name !== undefined ? result.guest.name : current.name,
    relationship: result.guest.relationship !== undefined ? result.guest.relationship : current.relationship,
    slotCount: result.guest.slotCount !== undefined ? result.guest.slotCount : current.slotCount,
  };

  const { rows } = await query(
    `UPDATE guests SET name = $1, relationship = $2, slot_count = $3, code = $4 WHERE id = $5 RETURNING *`,
    [next.name, next.relationship, next.slotCount, code, id]
  );
  return { success: true, guest: mapGuestRow(rows[0]) };
}

export async function softDeleteGuest(id) {
  if (!useDb) {
    const guest = guestStore.find((entry) => entry.id === id);
    if (!guest) return { success: false, reason: 'guest_not_found' };

    guest.isDeleted = true;
    guest.updatedAt = new Date().toISOString();
    return { success: true, guest: { ...guest } };
  }

  const { rows } = await query(
    'UPDATE guests SET is_deleted = true WHERE id = $1 RETURNING *',
    [id]
  );
  if (!rows[0]) return { success: false, reason: 'guest_not_found' };
  return { success: true, guest: mapGuestRow(rows[0]) };
}

/**
 * All RSVP responses in one query, for the admin dashboard (P0-08).
 *
 * The dashboard aggregates over the whole guest list, so fetching responses one
 * guest at a time via findRsvpResponseByGuestId() would be an N+1 — noticeable
 * at the ~350 guest units this wedding expects.
 */
export async function listAllRsvpResponses() {
  if (!useDb) {
    return rsvpResponses.map((entry) => ({ ...entry }));
  }

  const { rows } = await query('SELECT * FROM rsvp_responses');
  return rows.map(mapResponseRow);
}
