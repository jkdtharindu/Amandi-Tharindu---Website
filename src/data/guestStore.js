// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
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
