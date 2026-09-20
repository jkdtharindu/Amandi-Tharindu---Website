import { runInRsvpTransaction, lockGuest } from '../rsvp/saveRsvp.js';
import { softDeleteGuest } from './adminRepo.js';
import { unassignSeatsForGuest } from '../table-arrangement/tableArrangementRepo.js';

/**
 * Removing a whole guest (the Remove button on the guest list) used to only mark
 * the guest deleted. Their table seats were never touched, and the table window
 * reads seats with no is_deleted filter, so a removed guest and their people kept
 * showing on their seats (found by the owner on the live site, Next Action 56).
 *
 * This marks the guest deleted and frees every seat they or their invitees held,
 * in one transaction: if either step fails neither is kept and the error reaches
 * the caller. RSVP history is left alone, as before (PRD §7).
 *
 * Resolves to the deleted guest, or null when there is no such active guest — in
 * which case no seat is touched.
 *
 * `transaction` is injectable so tests can observe the statements and the
 * BEGIN/COMMIT/ROLLBACK around them; production always uses the default.
 *
 * @param {string} guestId
 * @param {{ transaction?: typeof runInRsvpTransaction }} [options]
 */
export function removeGuest(guestId, { transaction = runInRsvpTransaction } = {}) {
  return transaction(async (exec) => {
    await lockGuest(exec, guestId);

    const guest = await softDeleteGuest(guestId, exec);
    if (!guest) return null;

    await unassignSeatsForGuest(guestId, exec);
    return guest;
  });
}
