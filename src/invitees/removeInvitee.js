import { runInRsvpTransaction, lockGuest } from '../rsvp/saveRsvp.js';
import { deleteInvitee, deriveGuestRsvpStatus, listApprovedInvitees, listInviteesForGuest } from './inviteesRepo.js';
import { unassignSeatByInviteeId } from '../table-arrangement/tableArrangementRepo.js';
import { updateGuestRsvpStatus, upsertRsvpResponse } from '../guest-auth/guestRepo.js';
import { syncGuestSlotCountToInvitees } from '../admin/adminRepo.js';

/**
 * Removing one named person from a party is several writes that only make sense
 * together: free their seat, delete them, save the party's RSVP response and
 * status from whoever is left, and correct the headcount. They used to be
 * separate calls, and the RSVP pair sat in a try/catch that only logged, so a
 * failure there told the admin "removed" while the party's status stayed stale
 * (Next Action 50).
 *
 * All of it runs in one transaction here. If any step fails none of it is kept
 * and the error reaches the caller, so the admin is told to try again.
 *
 * Removing the last approved person is refused: it would leave a party with a
 * headcount of 0. The admin removes the whole party instead. The check runs
 * under the same row lock as the writes, so two removals cannot both pass it.
 *
 * `transaction` is injectable so tests can observe the statements and the
 * BEGIN/COMMIT/ROLLBACK around them; production always uses the default.
 *
 * @param {string} guestId
 * @param {string} inviteeId
 * @param {{ transaction?: typeof runInRsvpTransaction }} [options]
 * @returns {Promise<
 *   | { success: true, invitees: any[] }
 *   | { success: false, reason: 'invitee_not_found' | 'last_invitee' }
 * >}
 */
export function removeInviteeFromParty(guestId, inviteeId, { transaction = runInRsvpTransaction } = {}) {
  return transaction(async (exec) => {
    await lockGuest(exec, guestId);

    const everyone = await listInviteesForGuest(guestId, exec);
    const target = everyone.find((invitee) => invitee.id === inviteeId);
    if (!target) return { success: false, reason: 'invitee_not_found' };

    const approvedCount = everyone.filter((invitee) => invitee.approvalStatus === 'approved').length;
    if (target.approvalStatus === 'approved' && approvedCount === 1) {
      return { success: false, reason: 'last_invitee' };
    }

    await unassignSeatByInviteeId(inviteeId, exec);
    const deleted = await deleteInvitee(inviteeId, exec);
    if (!deleted.success) return { success: false, reason: 'invitee_not_found' };

    const remaining = await listApprovedInvitees(guestId, exec);
    const status = deriveGuestRsvpStatus(remaining);
    const acceptedNames = remaining.filter((invitee) => invitee.rsvpStatus === 'accepted').map((invitee) => invitee.name);

    await upsertRsvpResponse(guestId, status === 'accepted', acceptedNames, exec);
    await updateGuestRsvpStatus(guestId, status, exec);
    await syncGuestSlotCountToInvitees(guestId, exec);

    return { success: true, invitees: remaining };
  });
}
