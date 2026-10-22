import { runInRsvpTransaction, lockGuest } from '../rsvp/saveRsvp.js';
import { listInviteesForGuest } from './inviteesRepo.js';
import { findRsvpResponseByGuestId, upsertRsvpResponse } from '../guest-auth/guestRepo.js';
import { invitees } from '../data/inviteesStore.js';

export const MAX_PERSON_NAME_LENGTH = 100;

/**
 * Changes the name of one person already on an invitation: the admin learns the
 * real name of a plus-one after the invitation went out and corrects the entry.
 *
 * A person's name is stored in two places: their own row, and (for an accepted
 * party) the participant names mirrored into the party's RSVP response, which
 * the CSV export reads. Both change together in one transaction, so the export
 * never shows the old name. Nothing else needs touching: a seat, the RSVP
 * answer and the table message all refer to the person, not to the typed name.
 *
 * @param {string} guestId
 * @param {string} inviteeId
 * @param {string} rawName
 * @param {{ transaction?: typeof runInRsvpTransaction }} [options]
 * @returns {Promise<
 *   | { success: true, invitees: any[] }
 *   | { success: false, reason: 'invalid_name' | 'invitee_not_found' }
 * >}
 */
export function renameInviteeInParty(guestId, inviteeId, rawName, { transaction = runInRsvpTransaction } = {}) {
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > MAX_PERSON_NAME_LENGTH) return Promise.resolve({ success: false, reason: 'invalid_name' });

  return transaction(async (exec) => {
    await lockGuest(exec, guestId);

    const before = await listInviteesForGuest(guestId, exec);
    const target = before.find((invitee) => invitee.id === inviteeId);
    if (!target) return { success: false, reason: 'invitee_not_found' };

    if (exec) {
      await exec('UPDATE invitees SET name = $1, updated_at = now() WHERE id = $2 AND guest_id = $3', [
        name,
        inviteeId,
        guestId,
      ]);
    } else {
      const row = invitees.find((entry) => entry.id === inviteeId);
      row.name = name;
      row.updatedAt = new Date().toISOString();
    }

    // Keep the mirrored participant list in step so exports show the new name.
    const response = await findRsvpResponseByGuestId(guestId, exec);
    const oldName = target.name;
    if (response?.participantNames?.includes(oldName)) {
      const renamed = response.participantNames.map((entry) => (entry === oldName ? name : entry));
      await upsertRsvpResponse(guestId, response.attending, renamed, exec);
    }

    return { success: true, invitees: await listInviteesForGuest(guestId, exec) };
  });
}
