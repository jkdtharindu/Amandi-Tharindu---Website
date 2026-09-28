import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listGuestsByParty } from '../src/admin/adminRepo.js';
import { logMessage, listRecentLogsByParty, decorateLogs } from '../src/messaging/messageLogRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { messageLogs } from '../src/data/messageLogStore.js';

// Each admin (bride, groom) sees and messages only their own side's guests
// (multi-admin decision, 2026-09-20). Runs the in-memory path.

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Readers that return every side's rows. An admin page or route that sends their
// output to the browser leaks the other side's guests — names, WhatsApp numbers
// and invitation codes, which are the only thing a guest needs to sign in.
const ALL_SIDES_READERS = [
  'listAllGuests',
  'listSeatingTables',
  'listUnassignedGuests',
  'listAssignedGuests',
  'listUnassignedInvitees',
];

// Allowed only where the result becomes wedding-wide counts, never rows.
const COUNTS_ONLY = {
  'app/api/admin/guests/route.ts': ['listAllGuests'],
};

function sourceFiles(dir) {
  return readdirSync(join(ROOT, dir), { recursive: true })
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => relative(ROOT, join(ROOT, dir, file)).replaceAll('\\', '/'));
}

test('no admin page or route reads an all-sides list, except for wedding-wide counts', () => {
  const offenders = [];
  for (const file of [...sourceFiles('app/admin'), ...sourceFiles('app/api/admin')]) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    for (const reader of ALL_SIDES_READERS) {
      if (new RegExp(`\\b${reader}\\(`).test(source) && !COUNTS_ONLY[file]?.includes(reader)) {
        offenders.push(`${file}: ${reader}()`);
      }
    }
  }

  assert.deepEqual(offenders, [], 'use the side-filtered reader (…ByParty) with session.party instead');
});

// Content both admins manage together, sign-in itself, and the placeholder pool the
// owner chose to keep shared (Action 68). Every other admin route acts on one side's data.
const SHARED_ROUTES = [
  'app/api/admin/events/route.ts',
  'app/api/admin/events/[id]/route.ts',
  'app/api/admin/gallery/route.ts',
  'app/api/admin/gallery/[id]/route.ts',
  'app/api/admin/sections/route.ts',
  'app/api/admin/sections/[id]/route.ts',
  'app/api/admin/theme/route.ts',
  'app/api/admin/upload/route.ts',
  'app/api/admin/login/route.ts',
  'app/api/admin/logout/route.ts',
  'app/api/admin/table-arrangement/probable-attendees/route.ts',
];

test('every handler of a side-data admin route reads the signed-in side', () => {
  const missing = [];
  for (const file of sourceFiles('app/api/admin').filter((f) => f.endsWith('/route.ts'))) {
    if (SHARED_ROUTES.includes(file)) continue;
    const handlers = readFileSync(join(ROOT, file), 'utf8')
      .split(/(?=export async function (?:GET|POST|PUT|PATCH|DELETE)\b)/)
      .slice(1);
    for (const handler of handlers) {
      if (!/session\.party/.test(handler)) missing.push(`${file} ${handler.match(/function (\w+)/)[1]}`);
    }
  }

  assert.deepEqual(missing, [], 'check the id belongs to session.party (src/admin/sideAccess.js), or list the route as shared');
});

const GUESTS = [
  { id: 'b1', code: 'FRI-BR-001', name: 'Bride Friend', relationship: 'Friends', slotCount: 1, rsvpStatus: 'pending', isDeleted: false, assignedToParty: 'bride' },
  { id: 'bx', code: 'FRI-BR-002', name: 'Bride Removed', relationship: 'Friends', slotCount: 1, rsvpStatus: 'pending', isDeleted: true, assignedToParty: 'bride' },
  { id: 'old', code: 'REL-OL-003', name: 'Legacy Guest', relationship: 'Relations', slotCount: 1, rsvpStatus: 'pending', isDeleted: false },
  { id: 'g1', code: 'FRI-GR-004', name: 'Groom Friend', relationship: 'Friends', slotCount: 1, rsvpStatus: 'pending', isDeleted: false, assignedToParty: 'groom' },
];

beforeEach(() => {
  guestStore.length = 0;
  guestStore.push(...GUESTS.map((guest) => ({ ...guest })));
  messageLogs.length = 0;
});

test("listGuestsByParty returns one side's current guests; a guest with no side recorded is the bride's", async () => {
  assert.deepEqual((await listGuestsByParty('bride')).map((g) => g.id).sort(), ['b1', 'old']);
  assert.deepEqual((await listGuestsByParty('groom')).map((g) => g.id), ['g1']);
});

test("the message log shows only the signed-in side's entries, newest first", async () => {
  await logMessage({ guestId: 'b1', templateId: 't1' });
  await logMessage({ guestId: 'g1', templateId: 't1' });
  await logMessage({ guestId: 'old', templateId: 't1' });

  assert.deepEqual((await listRecentLogsByParty('bride')).map((log) => log.guestId), ['old', 'b1']);
  assert.deepEqual((await listRecentLogsByParty('groom')).map((log) => log.guestId), ['g1']);
});

test("the limit counts only the side's own entries, so the other side's activity cannot crowd them out", async () => {
  await logMessage({ guestId: 'b1', templateId: 't1' });
  await logMessage({ guestId: 'old', templateId: 't1' });
  for (let i = 0; i < 5; i += 1) await logMessage({ guestId: 'g1', templateId: 't1' });

  assert.deepEqual((await listRecentLogsByParty('bride', 2)).map((log) => log.guestId), ['old', 'b1']);
});

test("a removed guest's old log entry keeps their name", async () => {
  await logMessage({ guestId: 'bx', templateId: 't1' });

  const decorated = decorateLogs(await listRecentLogsByParty('bride'), [], []);

  assert.equal(decorated[0].guestName, 'Bride Removed');
  assert.equal(decorated[0].guestCode, 'FRI-BR-002');
});
