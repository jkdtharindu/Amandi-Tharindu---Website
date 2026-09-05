/**
 * In-memory ProbableAttendee store, used when DATABASE_URL is unset.
 *
 * Mirrors tableArrangementStore.js's pattern. Each entry is an anonymous
 * seat-holder placeholder: { id, bucket, slotIndex }. Never linked to a
 * guests row.
 */
export const probableAttendees = [];
