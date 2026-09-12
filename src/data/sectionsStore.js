// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
export const siteSections = (globalThis.__siteSections ??= []);
