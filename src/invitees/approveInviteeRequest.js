import { runInRsvpTransaction, lockGuest } from '../rsvp/saveRsvp.js';
import {
  approveInvitee,
  deriveGuestRsvpStatus,
  getInviteeById,
  listApprovedInvitees,
  listInviteesForGuest,
} from './inviteesRepo.js';
import { incrementGuestSlotCount } from '../admin/adminRepo.js';
import { findGuestById, updateGuestRsvpStatus } from '../guest-auth/guestRepo.js';

/**
 * Approving a guest's "add another person" request is three writes that only make
 * sense together: mark the person approved, add one to the party's headcount, and
 * re-derive the party's RSVP status. They used to be separate calls, so a failure
 * in between left the person approved with the headcount one short (Next Action 55).
 *
 * All of it runs in one transaction here. If any step fails none is kept and the
 * error reaches the caller, so the admin is told to try again.
 *
 * Only a request that is still waiting is approved. Approving one twice (a
 * double-click, or a stale page) used to add one to the headcount each time.
 * The check runs under the guest row lock, so two approvals cannot both pass it.
 *
 * The status is re-derived because an approved person starts out undecided: a
 * party where everyone had declined stops being "declined" the moment someone
 * undecided joins it, the same rule Actions 49 and 50 use. The rsvp_responses row
 * is deliberately not touched — nothing about the guest's own answer changed.
 *
 * A removed guest's request is refused. It is also hidden from the approval list;
 * this covers a stale page or a direct call. That check reads before the
 * transaction, which is fine for one admin and is not repeated under the lock.
 *
 * `transaction` is injectable so tests can observe the statements and the
 * BEGIN/COMMIT/ROLLBACK around them; production always uses the default.
 *
 * @param {string} inviteeId
 * @param {{ transaction?: typeof runInRsvpTransaction }} [options]
 * @returns {Promise<
 *   | { success: true, invitee: any }
 *   | { success: false, reason: 'invitee_not_found' | 'guest_removed' | 'not_pending' }
 * >}
 */
export async function approveInviteeRequest(inviteeId, { transaction = runInRsvpTransaction } = {}) {
  const found = await getInviteeById(inviteeId);
  if (!found) return { success: false, reason: 'invitee_not_found' };

  const guestId = found.guestId;
  if (!(await findGuestById(guestId))) return { success: false, reason: 'guest_removed' };

  return transaction(async (exec) => {
    await lockGuest(exec, guestId);

    const everyone = await listInviteesForGuest(guestId, exec);
    const target = everyone.find((invitee) => invitee.id === inviteeId);
    if (!target) return { success: false, reason: 'invitee_not_found' };
    if (target.approvalStatus !== 'pending_approval') return { success: false, reason: 'not_pending' };

    const approved = await approveInvitee(inviteeId, exec);
    if (!approved.success) return { success: false, reason: 'invitee_not_found' };

    await incrementGuestSlotCount(guestId, exec);

    const remaining = await listApprovedInvitees(guestId, exec);
    await updateGuestRsvpStatus(guestId, deriveGuestRsvpStatus(remaining), exec);

    return { success: true, invitee: approved.invitee };
  });
}
