// In-memory gallery photos store for DATABASE_URL-unset dev mode.
// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why: Turbopack's
// dev bundler instantiates this module twice (once per Route Handlers vs.
// Server Components bundle family), so a plain module-level array would make
// a write through one path invisible to a read through the other.
export const galleryPhotos = (globalThis.__galleryPhotos ??= []);
