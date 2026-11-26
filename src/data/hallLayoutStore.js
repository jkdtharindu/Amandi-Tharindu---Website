/** In-memory hall layout rows, used when DATABASE_URL is unset (same shape the repo returns). */
// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
export const hallLayoutItems = (globalThis.__hallLayoutItems ??= []);
