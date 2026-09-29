/**
 * In-memory MessageEvent store, used when DATABASE_URL is unset. Never had one
 * before (Action 73): getMessageEventsForGuest/recordMessageEvent both returned
 * nothing in this mode, so the per-guest "tick as sent" feature could not be
 * click-tested at all.
 */
// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
export const messageEvents = (globalThis.__messageEvents ??= []);
