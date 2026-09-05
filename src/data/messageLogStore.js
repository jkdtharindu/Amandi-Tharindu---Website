/**
 * In-memory MessageLog store, used when DATABASE_URL is unset. Shape matches
 * messageLogRepo's mapRow() output (camelCase). Insertion order is oldest
 * first; listRecentLogs() reverses it.
 */
export const messageLogs = [];
