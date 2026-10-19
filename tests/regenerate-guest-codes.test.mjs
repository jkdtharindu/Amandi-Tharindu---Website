import test from 'node:test';
import assert from 'node:assert/strict';

// No DATABASE_URL: adminRepo uses the in-memory guest store.
delete process.env.DATABASE_URL;

const { guestStore } = await import('../src/data/guestStore.js');
const { regenerateCodesForParty } = await import('../src/admin/adminRepo.js');

function seed() {
  guestStore.length = 0;
  guestStore.push(
    { id: 'a', code: 'SILVA-001', name: 'Nimal Silva', relationship: 'Friends', assignedToParty: 'bride', isDeleted: false },
    { id: 'b', code: 'R-FERN-001', name: 'Kamala Fernando', relationship: 'Relations', assignedToParty: 'bride', isDeleted: false },
    { id: 'c', code: 'GROOM-001', name: 'Ruwan Perera', relationship: 'Neighbours', assignedToParty: 'groom', isDeleted: false },
    { id: 'd', code: 'GONE-001', name: 'Removed Person', relationship: 'Friends', assignedToParty: 'bride', isDeleted: true },
  );
}

test('dry run reports the count and changes nothing', async () => {
  seed();
  const result = await regenerateCodesForParty('bride', { dryRun: true });
  assert.equal(result.count, 2);
  assert.deepEqual(guestStore.map((g) => g.code), ['SILVA-001', 'R-FERN-001', 'GROOM-001', 'GONE-001']);
});

test('gives each of the party\'s live guests a new 5-character code', async () => {
  seed();
  const result = await regenerateCodesForParty('bride');
  assert.equal(result.count, 2);

  const byId = Object.fromEntries(guestStore.map((g) => [g.id, g.code]));
  assert.match(byId.a, /^FN\d{3}$/);
  assert.match(byId.b, /^RK\d{3}$/);
});

test('leaves the other party and removed guests untouched', async () => {
  seed();
  await regenerateCodesForParty('bride');
  const byId = Object.fromEntries(guestStore.map((g) => [g.id, g.code]));
  assert.equal(byId.c, 'GROOM-001');
  assert.equal(byId.d, 'GONE-001');
});

test('every code stays unique across all guests', async () => {
  seed();
  for (let i = 0; i < 30; i += 1) {
    guestStore.push({ id: `x${i}`, code: `OLD${i}`, name: 'Nimal', relationship: 'Friends', assignedToParty: 'bride', isDeleted: false });
  }
  await regenerateCodesForParty('bride');
  const codes = guestStore.map((g) => g.code.toUpperCase());
  assert.equal(new Set(codes).size, codes.length);
});
