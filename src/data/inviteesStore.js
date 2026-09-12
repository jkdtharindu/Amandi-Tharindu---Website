/**
 * In-memory Invitee store, used when DATABASE_URL is unset. Shape matches
 * inviteesRepo's mapInviteeRow() output (camelCase), same pattern as
 * src/data/celebrationEventsStore.js.
 */
// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
export const invitees = (globalThis.__invitees ??= []);
