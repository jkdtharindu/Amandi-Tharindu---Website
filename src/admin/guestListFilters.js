import { MESSAGE_LEVELS } from '../messaging/messageLevels.js';

/**
 * The Guest list's extra filters (Member answers, Seating, Messaging). Pure and
 * browser-safe: the list already holds every number these need, so they filter
 * in place without another trip to the server.
 */

/** Option lists, in the order the dropdowns show them. */
export const ANSWER_FILTERS = [
  { value: 'all', label: 'All codes' },
  { value: 'complete', label: 'Everyone has answered' },
  { value: 'partial', label: 'Some answered, some still to reply' },
  { value: 'none', label: 'Nobody has answered yet' },
  { value: 'mixed', label: 'Mixed (some accepted, some declined)' },
];

export const SEATING_FILTERS = [
  { value: 'all', label: 'All seating' },
  { value: 'complete', label: 'All seated' },
  { value: 'partial', label: 'Partly seated' },
  { value: 'none', label: 'Not seated yet' },
  { value: 'skip', label: 'Declined (no seat needed)' },
];

export const MESSAGING_FILTERS = [
  { value: 'all', label: 'All messaging', group: '' },
  { value: 'none', label: 'Nothing sent yet', group: 'By progress' },
  { value: 'partial', label: 'Some steps sent', group: 'By progress' },
  { value: 'done', label: `All ${MESSAGE_LEVELS.length} steps sent`, group: 'By progress' },
  { value: 'no-number', label: 'No WhatsApp number', group: 'By progress' },
  ...MESSAGE_LEVELS.flatMap((level) => [
    { value: `${level.key}:not`, label: `Step ${level.number} (${level.label}) not sent`, group: 'By step' },
    { value: `${level.key}:sent`, label: `Step ${level.number} (${level.label}) sent`, group: 'By step' },
  ]),
];

/** @param {{ state: string, mixed: boolean } | undefined} answer */
export function matchesAnswers(filter, answer) {
  if (!filter || filter === 'all') return true;
  if (!answer) return false;
  if (filter === 'mixed') return answer.mixed;
  return answer.state === filter;
}

/** @param {{ status: string } | undefined} info  from computeSeatingCompletion */
export function matchesSeating(filter, info) {
  if (!filter || filter === 'all') return true;
  if (!info) return false;
  return info.status === filter;
}

/**
 * Messaging filters look at guests who can be messaged (have a number); the
 * "No WhatsApp number" filter is the only one that shows the others.
 * @param {{ eventName: string, isCompleted: boolean }[]} events
 */
export function matchesMessaging(filter, events = [], hasNumber = true) {
  if (!filter || filter === 'all') return true;
  if (filter === 'no-number') return !hasNumber;
  if (!hasNumber) return false;

  const done = new Set(events.filter((event) => event.isCompleted).map((event) => event.eventName));
  const doneCount = MESSAGE_LEVELS.filter((level) => done.has(level.eventName)).length;

  if (filter === 'none') return doneCount === 0;
  if (filter === 'partial') return doneCount > 0 && doneCount < MESSAGE_LEVELS.length;
  if (filter === 'done') return doneCount === MESSAGE_LEVELS.length;

  const [key, which] = filter.split(':');
  const level = MESSAGE_LEVELS.find((entry) => entry.key === key);
  if (!level) return true;
  return which === 'sent' ? done.has(level.eventName) : !done.has(level.eventName);
}
