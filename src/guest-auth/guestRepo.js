import { query } from '../db.js';
import { guestStore } from '../data/guestStore.js';
import { rsvpResponses } from '../data/rsvpStore.js';

const useDb = Boolean(process.env.DATABASE_URL);

function mapGuestRow(row) {
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

function mapResponseRow(row) {
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
