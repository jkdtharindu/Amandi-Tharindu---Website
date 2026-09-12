// globalThis-backed so every Turbopack module instance shares one array
// instead of each bundle getting its own disconnected copy -- see MEMORY.md's
// 2026-09-12 entry for the full diagnosis.
export const rsvpResponses = (globalThis.__rsvpResponses ??= []);
