import { withTransaction } from '../db.js';
import { updateGuestRsvpStatus, upsertRsvpResponse } from '../guest-auth/guestRepo.js';
import { deriveGuestRsvpStatus, updateInviteeRsvpStatuses } from '../invitees/inviteesRepo.js';

const useDb = Boolean(process.env.DATABASE_URL);

/**
 * Saving a guest's RSVP is several writes that only make sense together: the
 * rsvp_responses row, guests.rsvp_status and, for a party with named invitees,
 * each invitee's own answer. They used to be separate database calls, so a
 * failure between them left the admin's dashboard showing "pending" for a guest
 * who had just been told their RSVP was saved (Next Action 19d).
 *
 * These functions run all of it in one transaction. If any write fails, none of
 * them are kept and the error reaches the caller, so the guest is told to try
 * again instead of being told "saved".
 *
 * In-memory mode (no DATABASE_URL) has no transaction to open: the same steps
 * run against the in-memory stores, which cannot fail between one step and the
 * next. That mode exists only for local dev and tests.
 */

/**
 * Runs `work(exec)` where `exec` is a `(text, params) => Promise<{ rows }>`
 * query function tied to one transaction. Commits on success, rolls back on any
 * throw. Without a database, `work` gets `undefined` and the repos take their
 * in-memory branches.
 *
 * @template T
 * @param {(exec?: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>) => Promise<T>} work
 * @returns {Promise<T>}
 */
export function runInRsvpTransaction(work) {
  if (!useDb) return work(undefined);
  return withTransaction((client) => work((text, params) => client.query(text, params)));
}

/**
 * Takes a row lock on the guest for the rest of the transaction, so two
 * submissions for the same guest (a double-tapped Submit, or the same code open
 * on two phones) run one after the other. rsvp_responses.guest_id is not unique,
 * so without this both could see "no row yet" and each insert one.
 */
export async function lockGuest(exec, guestId) {
  if (!exec) return;
  await exec('SELECT id FROM guests WHERE id = $1 FOR UPDATE', [guestId]);
}

/**
 * The legacy whole-party RSVP: one accept/decline, free-text names. Names are
 * dropped on a decline.
 *
 * `transaction` is injectable so tests can observe the statements and the
 * BEGIN/COMMIT/ROLLBACK around them; production always uses the default.
 *
 * @param {string} guestId
 * @param {{ attending: boolean, participantNames?: string[] }} submission
 * @param {{ transaction?: typeof runInRsvpTransaction }} [options]
 */
export function saveWholePartyRsvp(
  guestId,
  { attending, participantNames = [] },
  { transaction = runInRsvpTransaction } = {}
) {
  return transaction(async (exec) => {
    await lockGuest(exec, guestId);
    const result = await upsertRsvpResponse(guestId, attending, attending ? participantNames : [], exec);
    await updateGuestRsvpStatus(guestId, attending ? 'accepted' : 'declined', exec);
    return result;
  });
}

/**
 * A guest with named invitees answers per person. The party's own status is
 * derived from those answers and mirrored, with the accepted names, into
 * rsvp_responses so every existing reader (CSV export, dashboard stats) keeps
 * working unchanged. `inviteeResponses` is [{ id, attending }]; ids that are not
 * one of this guest's approved invitees are ignored.
 *
 * @param {string} guestId
 * @param {{ id: string, attending: boolean }[]} inviteeResponses
 * @param {{ transaction?: typeof runInRsvpTransaction }} [options]
 */
export function saveInviteeRsvp(
  guestId,
  inviteeResponses,
  { transaction = runInRsvpTransaction } = {}
) {
  return transaction(async (exec) => {
    await lockGuest(exec, guestId);
    const updated = await updateInviteeRsvpStatuses(guestId, inviteeResponses, exec);
    const status = deriveGuestRsvpStatus(updated);
    const acceptedNames = updated.filter((invitee) => invitee.rsvpStatus === 'accepted').map((invitee) => invitee.name);

    const result = await upsertRsvpResponse(guestId, status === 'accepted', acceptedNames, exec);
    await updateGuestRsvpStatus(guestId, status, exec);
    return result;
  });
}
