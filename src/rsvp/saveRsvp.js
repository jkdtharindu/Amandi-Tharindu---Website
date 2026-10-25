import { withTransaction } from '../db.js';
import { deleteRsvpResponse, updateGuestRsvpStatus, upsertRsvpResponse } from '../guest-auth/guestRepo.js';
import { deriveGuestRsvpStatus, listApprovedInvitees, updateInviteeRsvpStatuses } from '../invitees/inviteesRepo.js';

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
 * A guest with named invitees answers per person, and each person can answer on
 * their own, at a different time. Only the people in `inviteeResponses` are
 * written; everyone else keeps whatever they had (usually 'pending'), so two
 * people in one party saving separately never overwrite each other.
 *
 * `inviteeResponses` is [{ id, attending, expectedStatus?, dietaryNotes? }].
 * `expectedStatus` is the answer the page last showed for that person. If the
 * saved answer has since changed to something else (another phone saved first),
 * that entry is skipped and reported in `conflicts` instead of being silently
 * overwritten; the rest of the batch still saves. Ids that are not one of this
 * guest's approved invitees are ignored.
 *
 * The party's own status is derived from all the answers and mirrored, with the
 * accepted names, into rsvp_responses so every existing reader (CSV export,
 * dashboard stats) keeps working unchanged. A party that is still undecided
 * overall has no mirrored row at all: rsvp_responses can only say attending or
 * not, and a half-answered party must not read as declined.
 *
 * @param {string} guestId
 * @param {{ id: string, attending: boolean, expectedStatus?: string, dietaryNotes?: string }[]} inviteeResponses
 * @param {{ transaction?: typeof runInRsvpTransaction }} [options]
 * @returns {Promise<{ status: string, response: object | null, invitees: object[], conflicts: string[] }>}
 */
export function saveInviteeRsvp(
  guestId,
  inviteeResponses,
  { transaction = runInRsvpTransaction } = {}
) {
  return transaction(async (exec) => {
    await lockGuest(exec, guestId);

    // Read under the lock, so no one can change an answer between this check
    // and the write below.
    const current = new Map((await listApprovedInvitees(guestId, exec)).map((invitee) => [invitee.id, invitee]));
    const toApply = [];
    const conflicts = [];
    for (const entry of inviteeResponses) {
      const saved = current.get(entry.id);
      if (!saved) continue;
      const desired = entry.attending ? 'accepted' : 'declined';
      const changedUnderUser =
        entry.expectedStatus !== undefined && saved.rsvpStatus !== entry.expectedStatus && saved.rsvpStatus !== desired;
      if (changedUnderUser) conflicts.push(entry.id);
      else toApply.push(entry);
    }

    const updated = await updateInviteeRsvpStatuses(guestId, toApply, exec);
    const status = deriveGuestRsvpStatus(updated);
    const acceptedNames = updated.filter((invitee) => invitee.rsvpStatus === 'accepted').map((invitee) => invitee.name);

    let response = null;
    if (status === 'pending') {
      await deleteRsvpResponse(guestId, exec);
    } else {
      response = await upsertRsvpResponse(guestId, status === 'accepted', acceptedNames, exec);
    }
    await updateGuestRsvpStatus(guestId, status, exec);
    return { status, response, invitees: updated, conflicts };
  });
}
