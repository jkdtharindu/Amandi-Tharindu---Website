/**
 * A finer RSVP status for the admin guest list, worked out from the people in
 * each party. The stored `rsvpStatus` (pending / accepted / declined) is NOT
 * changed -- seating, messaging and the dashboard all still use it. This is
 * only a label and a filter for the guest list.
 *
 *   accepted_all     every approved person accepted ("Totally accepted")
 *   accepted_partial at least one accepted, but not everyone
 *   declined_partial nobody accepted; some declined, the rest have not answered
 *   declined         every approved person declined
 *   pending          nobody has answered yet
 *
 * A party with no named people (older, headcount-only) falls back to its
 * stored status: accepted counts as totally accepted.
 */

export const RSVP_DETAIL_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted_partial', label: 'Accepted partially' },
  { value: 'accepted_all', label: 'Totally accepted' },
  { value: 'declined_partial', label: 'Declined partially' },
  { value: 'declined', label: 'Declined' },
];

export const RSVP_DETAIL_LABELS = Object.fromEntries(
  RSVP_DETAIL_OPTIONS.map((option) => [option.value, option.label])
);

export function deriveRsvpDetail(guest, inviteeList = []) {
  const people = inviteeList.filter(
    (invitee) => invitee.guestId === guest.id && invitee.approvalStatus === 'approved'
  );

  if (people.length === 0) {
    if (guest.rsvpStatus === 'accepted') return 'accepted_all';
    if (guest.rsvpStatus === 'declined') return 'declined';
    return 'pending';
  }

  const accepted = people.filter((person) => person.rsvpStatus === 'accepted').length;
  const declined = people.filter((person) => person.rsvpStatus === 'declined').length;

  if (accepted === people.length) return 'accepted_all';
  if (declined === people.length) return 'declined';
  if (accepted > 0) return 'accepted_partial';
  if (declined > 0) return 'declined_partial';
  return 'pending';
}

/** Adds `rsvpDetail` to every guest. */
export function withRsvpDetail(guests = [], inviteeList = []) {
  return guests.map((guest) => ({ ...guest, rsvpDetail: deriveRsvpDetail(guest, inviteeList) }));
}
