/**
 * In-memory ProbableAttendee store, used when DATABASE_URL is unset.
 *
 * Mirrors tableArrangementStore.js's pattern. Each entry is an anonymous
 * seat-holder placeholder: { id, bucket, slotIndex }. Never linked to a
 * guests row.
 */
// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
export const probableAttendees = (globalThis.__probableAttendees ??= []);
