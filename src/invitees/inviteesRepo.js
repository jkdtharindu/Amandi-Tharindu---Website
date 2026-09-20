import crypto from 'node:crypto';
import { query } from '../db.js';
import { invitees } from '../data/inviteesStore.js';

const useDb = Boolean(process.env.DATABASE_URL);

// Postgres invalid_text_representation -- thrown when a non-UUID string
// (e.g. a malformed or stale id in a request) is compared against a uuid
// column. Treated as "not found" rather than a server error, the same way
// an unmatched real id already is.
const INVALID_UUID = '22P02';

export function mapInviteeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    guestId: row.guest_id,
    name: row.name,
    rsvpStatus: row.rsvp_status,
    addedBy: row.added_by,
    approvalStatus: row.approval_status,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Decides the whole party's rsvp_status from its invitees: 'accepted' the
 * moment any one of them has accepted (so the accepted ones can be seated
 * right away, even while others are still undecided), 'declined' only once
 * every one of them has declined, otherwise 'pending'. Pending-approval
 * (unapproved guest-requested) invitees are ignored entirely.
 */
export function deriveGuestRsvpStatus(inviteeList = []) {
  const approved = inviteeList.filter((invitee) => invitee.approvalStatus === 'approved');
  if (approved.length === 0) return 'pending';
  if (approved.some((invitee) => invitee.rsvpStatus === 'accepted')) return 'accepted';
  if (approved.every((invitee) => invitee.rsvpStatus === 'declined')) return 'declined';
  return 'pending';
}

/**
 * Creates one invitee row per name for a guest, in the order given.
 * `addedBy`/`approvalStatus` distinguish admin-entered names (auto-approved)
 * from a guest's own "add another person" request (pending_approval).
 */
export async function createInviteesForGuest(guestId, names, { addedBy = 'admin', approvalStatus = 'approved' } = {}) {
  const created = [];

  if (!useDb) {
    const startIndex = invitees.filter((entry) => entry.guestId === guestId).length;
    names.forEach((name, offset) => {
      const invitee = {
        id: crypto.randomUUID(),
        guestId,
        name,
        rsvpStatus: 'pending',
        addedBy,
        approvalStatus,
        displayOrder: startIndex + offset,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      invitees.push(invitee);
      created.push(invitee);
    });
    return created;
  }

  const { rows: existingRows } = await query(
    'SELECT COUNT(*)::int AS count FROM invitees WHERE guest_id = $1',
    [guestId]
  );
  const startIndex = existingRows[0]?.count || 0;

  for (let offset = 0; offset < names.length; offset += 1) {
    const { rows } = await query(
      `INSERT INTO invitees (guest_id, name, added_by, approval_status, display_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [guestId, names[offset], addedBy, approvalStatus, startIndex + offset]
    );
    created.push(mapInviteeRow(rows[0]));
  }
  return created;
}

// `exec` (optional, last argument) is a `(text, params) => Promise<{ rows }>`
// query function belonging to an open transaction — see the note above
// findRsvpResponseByGuestId in src/guest-auth/guestRepo.js. A read that has to
// see its own transaction's uncommitted writes must be given it, because a
// separate pool connection cannot.

/** Every invitee for a guest, including their own pending requests. */
export async function listInviteesForGuest(guestId, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    return invitees
      .filter((invitee) => invitee.guestId === guestId)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((invitee) => ({ ...invitee }));
  }

  try {
    const { rows } = await run(
      'SELECT * FROM invitees WHERE guest_id = $1 ORDER BY display_order ASC',
      [guestId]
    );
    return rows.map(mapInviteeRow);
  } catch (error) {
    if (error.code === INVALID_UUID) return [];
    throw error;
  }
}

/** Only the approved invitees for a guest — what counts toward RSVP/seating. */
export async function listApprovedInvitees(guestId, exec) {
  const all = await listInviteesForGuest(guestId, exec);
  return all.filter((invitee) => invitee.approvalStatus === 'approved');
}

/** Every guest-requested invitee still awaiting admin approval, across all guests. */
export async function listPendingApprovalInvitees() {
  if (!useDb) {
    return invitees
      .filter((invitee) => invitee.approvalStatus === 'pending_approval')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((invitee) => ({ ...invitee }));
  }

  const { rows } = await query(
    `SELECT * FROM invitees WHERE approval_status = 'pending_approval' ORDER BY created_at ASC`
  );
  return rows.map(mapInviteeRow);
}

export async function getInviteeById(id) {
  if (!useDb) {
    const invitee = invitees.find((entry) => entry.id === id);
    return invitee ? { ...invitee } : null;
  }

  try {
    const { rows } = await query('SELECT * FROM invitees WHERE id = $1', [id]);
    return mapInviteeRow(rows[0]);
  } catch (error) {
    if (error.code === INVALID_UUID) return null;
    throw error;
  }
}

/**
 * `exec` (optional) is the open transaction's query function; see approveInviteeRequest.js.
 * Supplying it also selects the SQL branch, as in the other transactional repo functions.
 */
export async function approveInvitee(id, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const invitee = invitees.find((entry) => entry.id === id);
    if (!invitee) return { success: false, reason: 'invitee_not_found' };
    invitee.approvalStatus = 'approved';
    invitee.updatedAt = new Date().toISOString();
    return { success: true, invitee: { ...invitee } };
  }

  const { rows } = await run(
    `UPDATE invitees SET approval_status = 'approved', updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!rows[0]) return { success: false, reason: 'invitee_not_found' };
  return { success: true, invitee: mapInviteeRow(rows[0]) };
}

export async function rejectInvitee(id) {
  if (!useDb) {
    const invitee = invitees.find((entry) => entry.id === id);
    if (!invitee) return { success: false, reason: 'invitee_not_found' };
    invitee.approvalStatus = 'rejected';
    invitee.updatedAt = new Date().toISOString();
    return { success: true, invitee: { ...invitee } };
  }

  const { rows } = await query(
    `UPDATE invitees SET approval_status = 'rejected', updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!rows[0]) return { success: false, reason: 'invitee_not_found' };
  return { success: true, invitee: mapInviteeRow(rows[0]) };
}

/**
 * Updates rsvp_status for a batch of a guest's own approved invitees.
 * `updates` is [{ id, attending }]; ids that don't belong to this guest or
 * aren't approved are silently ignored, so a tampered id can't touch
 * someone else's invitee.
 */
export async function updateInviteeRsvpStatuses(guestId, updates = [], exec) {
  const approvedIds = new Set((await listApprovedInvitees(guestId, exec)).map((invitee) => invitee.id));
  const valid = updates.filter((update) => approvedIds.has(update.id));

  const run = exec ?? (useDb ? query : null);
  if (!run) {
    valid.forEach(({ id, attending }) => {
      const invitee = invitees.find((entry) => entry.id === id);
      if (invitee) {
        invitee.rsvpStatus = attending ? 'accepted' : 'declined';
        invitee.updatedAt = new Date().toISOString();
      }
    });
    return listApprovedInvitees(guestId);
  }

  for (const { id, attending } of valid) {
    await run(
      `UPDATE invitees SET rsvp_status = $1, updated_at = now() WHERE id = $2 AND guest_id = $3`,
      [attending ? 'accepted' : 'declined', id, guestId]
    );
  }
  return listApprovedInvitees(guestId, exec);
}

/** A guest requests to add someone not on the original list — needs admin approval. */
export async function requestNewInvitee(guestId, name) {
  const [created] = await createInviteesForGuest(guestId, [name], {
    addedBy: 'guest',
    approvalStatus: 'pending_approval',
  });
  return created;
}

/**
 * Permanently removes one named person from a party. Callers are responsible
 * for freeing any seat that referenced this invitee first (see
 * unassignSeatByInviteeId in tableArrangementRepo.js) and for re-deriving the
 * party's rsvp_status/slot_count afterward — this function only removes the row.
 * `exec` (optional) is the open transaction's query function; see removeInvitee.js.
 */
export async function deleteInvitee(id, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const index = invitees.findIndex((entry) => entry.id === id);
    if (index === -1) return { success: false, reason: 'invitee_not_found' };
    const [removed] = invitees.splice(index, 1);
    return { success: true, invitee: { ...removed } };
  }

  const { rows } = await run('DELETE FROM invitees WHERE id = $1 RETURNING *', [id]);
  if (!rows[0]) return { success: false, reason: 'invitee_not_found' };
  return { success: true, invitee: mapInviteeRow(rows[0]) };
}
