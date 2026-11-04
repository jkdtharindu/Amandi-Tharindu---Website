import { computeCodeBreakdown } from './guestQueries.js';

/**
 * How far each invitation code is through answering, person by person.
 *
 * A code (one party) can hold many people, and they answer one at a time, so a
 * single "accepted / declined / pending" label hides the in-between cases. This
 * works from the same per-person counts as the dashboard (computeCodeBreakdown),
 * so the two cannot disagree.
 *
 *   complete: everyone has answered (nobody pending)
 *   partial:  somebody has answered and somebody has not
 *   none:     nobody has answered yet
 *
 * `mixed` is separate: the code has at least one acceptance AND one decline.
 *
 * @returns {{ byGuestId: Record<string, object>, totals: object, waiting: object[] }}
 */
export function answerState({ invited, accepted, declined, pending }) {
  const answered = accepted + declined;
  let state;
  if (invited > 0 && pending === 0) state = 'complete';
  else if (answered === 0) state = 'none';
  else state = 'partial';
  return { state, mixed: accepted > 0 && declined > 0 };
}

export function summarizeAnswers(guests = [], responses = [], invitees = []) {
  const active = guests.filter((guest) => !guest.isDeleted);
  const guestByCode = new Map(active.map((guest) => [guest.code, guest]));
  const { rows } = computeCodeBreakdown(active, responses, invitees);

  const byGuestId = {};
  const waiting = [];
  const totals = { codes: 0, complete: 0, partial: 0, none: 0, mixed: 0 };

  for (const row of rows) {
    const guest = guestByCode.get(row.code);
    if (!guest) continue;

    const { state, mixed } = answerState(row);
    byGuestId[guest.id] = {
      invited: row.invited,
      accepted: row.accepted,
      declined: row.declined,
      pending: row.pending,
      state,
      mixed,
    };

    totals.codes += 1;
    totals[state] += 1;
    if (mixed) totals.mixed += 1;
    if (state === 'partial') {
      waiting.push({
        guestId: guest.id,
        code: row.code,
        name: row.name,
        invited: row.invited,
        accepted: row.accepted,
        declined: row.declined,
        pending: row.pending,
      });
    }
  }

  waiting.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
  return { byGuestId, totals, waiting };
}
