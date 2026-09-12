/**
 * In-memory MessageLog store, used when DATABASE_URL is unset. Shape matches
 * messageLogRepo's mapRow() output (camelCase). Insertion order is oldest
 * first; listRecentLogs() reverses it.
 */
// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
export const messageLogs = (globalThis.__messageLogs ??= []);
