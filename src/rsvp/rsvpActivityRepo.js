import crypto from 'node:crypto';
import { query } from '../db.js';
import { guestStore } from '../data/guestStore.js';

/**
 * The history behind the dashboard's "Recent RSVP answers" card: one line each time a
 * person's answer is saved as accepted or declined (migration 037). It is written
 * AFTER the RSVP transaction commits and never throws, so a problem here (for example
 * the migration has not run yet) can never stop a guest's answer from being saved.
 */

const isDbEnabled = () => Boolean(process.env.DATABASE_URL);

// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
export const rsvpActivity = (globalThis.__rsvpActivity ??= []);

function mapRow(row) {
  return {
    id: row.id,
    guestId: row.guest_id,
    personName: row.person_name,
    guestName: row.guest_name,
    party: row.party,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * @param {string} guestId
 * @param {{ personName?: string | null, status: 'accepted' | 'declined' }[]} entries (no name = the guest's own name)
 */
export async function recordRsvpActivity(guestId, entries = []) {
  const lines = entries.filter((entry) => entry.status === 'accepted' || entry.status === 'declined');
  if (lines.length === 0) return;

  try {
    if (!isDbEnabled()) {
      const guest = guestStore.find((entry) => entry.id === guestId);
      if (!guest) return;
      for (const line of lines) {
        rsvpActivity.push({
          id: crypto.randomUUID(),
          guestId,
          personName: line.personName || guest.name,
          guestName: guest.name,
          party: guest.assignedToParty ?? 'bride',
          status: line.status,
          createdAt: new Date().toISOString(),
        });
      }
      return;
    }

    for (const line of lines) {
      await query(
        `INSERT INTO rsvp_activity (guest_id, person_name, guest_name, party, status)
         SELECT g.id, COALESCE($2, g.name), g.name, g.assigned_to_party, $3 FROM guests g WHERE g.id = $1`,
        [guestId, line.personName ?? null, line.status]
      );
    }
  } catch (error) {
    console.error('Could not record RSVP activity:', error);
  }
}

/** The newest answers for one side, newest first. Never throws: the dashboard still loads. */
export async function listRsvpActivity(party, limit = 100) {
  try {
    if (!isDbEnabled()) {
      return rsvpActivity
        .filter((entry) => entry.party === party)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((entry) => ({ ...entry }));
    }
    const { rows } = await query(
      'SELECT * FROM rsvp_activity WHERE party = $1 ORDER BY created_at DESC LIMIT $2',
      [party, limit]
    );
    return rows.map(mapRow);
  } catch (error) {
    console.error('Could not load RSVP activity:', error);
    return [];
  }
}
