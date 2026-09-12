/**
 * In-memory CelebrationEvent store, used when DATABASE_URL is unset. Shape
 * matches celebrationEventsRepo's mapRow() output (camelCase) so the page
 * renders identically with or without a database.
 *
 * Seeded with the same two events the-celebration page has hardcoded since
 * launch, mirroring migration 009's seed rows.
 */
// globalThis-backed -- see MEMORY.md's 2026-09-12 entry for why.
export const celebrationEvents = (globalThis.__celebrationEvents ??= [
  {
    id: 'event-ceremony',
    name: 'Ceremony',
    eventDate: '2026-12-14',
    eventTime: '3:00 PM',
    venueName: 'Sunrise Garden Hall',
    venueAddress: '',
    imageUrl: '',
    displayOrder: 0,
  },
  {
    id: 'event-reception',
    name: 'Reception',
    eventDate: '2026-12-14',
    eventTime: '6:00 PM',
    venueName: 'Moonlight Banquet Hall',
    venueAddress: '',
    imageUrl: '',
    displayOrder: 1,
  },
]);
