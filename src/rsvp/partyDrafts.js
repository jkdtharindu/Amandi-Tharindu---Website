/**
 * The RSVP form's bookkeeping for a party where each person answers on their
 * own: what each person has saved on the server, what they have picked on this
 * page but not saved yet (a "draft"), and which drafts are worth sending.
 *
 * Pure functions, no React and no network, so the rules can be tested without a
 * browser. The page keeps `saved` (a snapshot of the server's answers) and
 * `drafts` (one { choice } per approved person) and calls these.
 *
 * Each draft is { choice }: 'accepted' | 'declined' | null (null = nothing
 * picked, i.e. pending).
 */

export function choiceOf(status) {
  if (status === 'accepted') return 'accepted';
  if (status === 'declined') return 'declined';
  return null;
}

export function draftFromInvitee(invitee) {
  return { choice: choiceOf(invitee.rsvpStatus) };
}

/** Approved people only, in display order -- the ones that get an answer. */
export function approvedInvitees(invitees = []) {
  return invitees
    .filter((invitee) => invitee.approvalStatus === 'approved')
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function draftsFor(invitees = []) {
  return Object.fromEntries(approvedInvitees(invitees).map((invitee) => [invitee.id, draftFromInvitee(invitee)]));
}

/**
 * True when the draft would change what is saved: a different answer. A person
 * nobody has picked for is never "changed" -- they stay pending.
 */
export function isChanged(invitee, draft) {
  if (!draft || !draft.choice) return false;
  return draft.choice !== choiceOf(invitee.rsvpStatus);
}

/**
 * The request body entries: only people whose draft changed. `expectedStatus`
 * is what this page last saw, so the server can tell if someone else saved a
 * different answer in the meantime.
 */
export function buildResponses(approved, drafts) {
  const entries = [];
  for (const invitee of approved) {
    const draft = drafts[invitee.id];
    if (!isChanged(invitee, draft)) continue;
    const entry = {
      id: invitee.id,
      attending: draft.choice === 'accepted',
      expectedStatus: invitee.rsvpStatus,
    };
    entries.push(entry);
  }
  return entries;
}

/** People who will have an answer once the changed drafts are saved. */
export function countAnswered(approved, drafts) {
  return approved.filter((invitee) => (drafts[invitee.id]?.choice ?? null) !== null).length;
}

/** People who already have a saved answer. */
export function countSavedAnswers(approved) {
  return approved.filter((invitee) => choiceOf(invitee.rsvpStatus) !== null).length;
}

/**
 * Folds freshly fetched server answers into the page without losing what the
 * user is in the middle of typing. A person the user has not touched follows the
 * server; a person the user has edited keeps their draft, unless their id is in
 * `resetIds` (the server refused our change because someone else saved first --
 * theirs wins). `changed` is true when the server's answers differ from the
 * snapshot the page had.
 */
export function mergeFreshInvitees(oldSaved, oldDrafts, fresh, { resetIds = /** @type {string[]} */ ([]) } = {}) {
  const oldApproved = new Map(approvedInvitees(oldSaved).map((invitee) => [invitee.id, invitee]));
  const freshApproved = approvedInvitees(fresh);
  const reset = new Set(resetIds);

  let changed = oldApproved.size !== freshApproved.length;
  const drafts = {};
  for (const invitee of freshApproved) {
    const before = oldApproved.get(invitee.id);
    if (!before || before.rsvpStatus !== invitee.rsvpStatus) {
      changed = true;
    }
    const draft = oldDrafts[invitee.id];
    const touched = Boolean(before && draft && isChanged(before, draft));
    drafts[invitee.id] = touched && !reset.has(invitee.id) ? draft : draftFromInvitee(invitee);
  }
  return { drafts, changed };
}
