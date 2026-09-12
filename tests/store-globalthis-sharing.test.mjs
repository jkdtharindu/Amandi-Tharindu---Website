import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Regression test for the 2026-09-12 fix: Turbopack's dev module graph can
 * instantiate a `src/data/*.js` store twice (observed for Route Handlers vs.
 * Page Server Components -- see MEMORY.md's 2026-09-12 entry), which used to
 * give each instantiation its own, disconnected array/object. A plain
 * `node --test` run never reproduces that split on its own (each test file
 * already gets a single fresh process), so this test recreates it directly:
 * importing the same store module twice with different query strings forces
 * Node to evaluate it twice, the same way two Turbopack bundles would. Every
 * store is expected to export the exact same object both times, because its
 * top-level `const` is backed by `globalThis` rather than a plain literal.
 */

const STORE_FILES = [
  { path: '../src/data/guestStore.js', export: 'guestStore' },
  { path: '../src/data/rsvpStore.js', export: 'rsvpResponses' },
  { path: '../src/data/adminStore.js', export: 'adminStore' },
  { path: '../src/data/sectionsStore.js', export: 'siteSections' },
  { path: '../src/data/tableArrangementStore.js', export: 'seatingTables' },
  { path: '../src/data/messageLogStore.js', export: 'messageLogs' },
  { path: '../src/data/messageTemplatesStore.js', export: 'messageTemplates' },
  { path: '../src/data/probableAttendeesStore.js', export: 'probableAttendees' },
  { path: '../src/data/celebrationEventsStore.js', export: 'celebrationEvents' },
  { path: '../src/data/inviteesStore.js', export: 'invitees' },
  { path: '../src/data/themeStore.js', export: 'themeSettings' },
];

for (const { path, export: exportName } of STORE_FILES) {
  test(`${exportName} stays the same object across two separate module instantiations`, async () => {
    const url = new URL(path, import.meta.url).href;
    const m1 = await import(url);
    const m2 = await import(`${url}?instance=2`);

    assert.equal(
      m1[exportName],
      m2[exportName],
      `${exportName} must be one shared object (globalThis-backed), not a fresh one per module instantiation`
    );
  });
}

test('a write through one module instantiation is visible through another (the actual bug this fixes)', async () => {
  const url = new URL('../src/data/rsvpStore.js', import.meta.url).href;
  const m1 = await import(`${url}?write-visibility=1`);
  const m2 = await import(`${url}?write-visibility=2`);

  const marker = { note: 'written via m1' };
  m1.rsvpResponses.push(marker);

  assert.ok(
    m2.rsvpResponses.includes(marker),
    'a push via one "instantiation" (e.g. a Route Handler bundle) must be visible via another (e.g. a Page bundle)'
  );
});
