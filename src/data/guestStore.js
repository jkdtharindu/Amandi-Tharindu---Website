// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
//
// The 'guest-N' ids are deliberately predictable: these are fixtures, and the
// tests address them by name. That was briefly dangerous — until Next Action
// 33, an unset SESSION_SECRET outside production turned session signing into a
// no-op, so `Cookie: guest_session=guest-1` was a working login. The fix was
// to sign sessions unconditionally (src/session.js), not to randomise these
// ids, which would buy nothing now and cost every test its fixture handles.
// Real rows use Postgres uuids (migrations/001_create_guests.sql).
export const guestStore = (globalThis.__guestStore ??= [
  {
    id: 'guest-1',
    code: 'SILVA-001',
    name: 'Nimal Silva',
    relationship: 'Family',
    slotCount: 2,
    whatsappNumber: '+94123456789',
    email: 'nimal@example.com',
    rsvpStatus: 'pending',
    isDeleted: false,
    hasVisited: false,
  },
  {
    id: 'guest-2',
    code: 'SILVA-002',
    name: 'Kumara Perera',
    relationship: 'Friend',
    slotCount: 1,
    whatsappNumber: null,
    email: 'kumara@example.com',
    rsvpStatus: 'pending',
    isDeleted: true,
    hasVisited: false,
  }
]);
