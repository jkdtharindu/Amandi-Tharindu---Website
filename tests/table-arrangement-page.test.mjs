import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { guestStore } from '../src/data/guestStore.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { probableAttendees } from '../src/data/probableAttendeesStore.js';
import { TEST_ADMIN, seedTestAdmin } from './helpers/adminFixture.mjs';

// Table Arrangement (P2) — route level.
//
// The point of these tests is the no-database case. adminPageWrapper renders a
// "Table Arrangement" link into the nav of EVERY admin page, so if this route
// throws without DATABASE_URL the whole admin area ships with a link that 500s.
// These tests run with DATABASE_URL unset, which is exactly that case.

const DEFAULT_ADMIN = { email: TEST_ADMIN.email, password: TEST_ADMIN.password };
const ORIGINAL_GUESTS = structuredClone(guestStore);

const ACCEPTED_GUESTS = [
  {
    id: 'g-seat-1',
    code: 'SEAT-001',
    name: 'Anula Gunasekara',
    relationship: 'Relations',
    slotCount: 1,
    whatsappNumber: null,
    email: null,
    rsvpStatus: 'accepted',
    isDeleted: false,
    hasVisited: true,
  },
  {
    id: 'g-seat-2',
    code: 'SEAT-002',
    name: 'Nimal Silva',
    relationship: 'Friends',
    slotCount: 2,
    whatsappNumber: null,
    email: null,
    rsvpStatus: 'accepted',
    isDeleted: false,
    hasVisited: true,
  },
];

beforeEach(() => {
  seedTestAdmin();
  seatingTables.length = 0;
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS), ...structuredClone(ACCEPTED_GUESTS));
  probableAttendees.length = 0;
});

afterEach(() => {
  seatingTables.length = 0;
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS));
  probableAttendees.length = 0;
});

function request(port, { path, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const allHeaders = { ...headers };
    if (payload) {
      allHeaders['Content-Type'] = 'application/json';
      allHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: allHeaders }, (res) => {
      let text = '';
      res.on('data', (chunk) => (text += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(text || 'null');
        } catch {
          json = null;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, text, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseCookies(setCookieHeaders) {
  return (setCookieHeaders || []).map((header) => header.split(';')[0]).join('; ');
}

function csrfFrom(cookie) {
  const match = /csrf_token=([^;]+)/.exec(cookie || '');
  return match ? match[1] : '';
}

async function withServer(fn) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function loginAdmin(port) {
  const landing = await request(port, { path: '/admin' });
  const cookie = parseCookies(landing.headers['set-cookie']);
  const res = await request(port, {
    path: '/api/admin/login',
    method: 'POST',
    headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
    body: DEFAULT_ADMIN,
  });
  assert.equal(res.statusCode, 200, 'admin login should succeed');
  return [cookie, parseCookies(res.headers['set-cookie'])].filter(Boolean).join('; ');
}

test('the seating page and its API are admin-only', async () => {
  await withServer(async (port) => {
    const page = await request(port, { path: '/admin/table-arrangement' });
    assert.equal(page.statusCode, 302, 'the page redirects when signed out');
    assert.equal(page.headers.location, '/admin');

    const api = await request(port, { path: '/api/admin/table-arrangement' });
    assert.equal(api.statusCode, 401, 'the seating data must not be public');

    const download = await request(port, { path: '/api/admin/table-arrangement/export' });
    assert.equal(download.statusCode, 401, 'the export must not be downloadable while signed out');
  });
});

test('the seating page renders with no database configured', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, { path: '/admin/table-arrangement', headers: { Cookie: cookie } });

    assert.equal(res.statusCode, 200, 'the nav link every admin page renders must not 500');
    assert.match(res.text, /Table Arrangement/);
    assert.match(res.text, /No tables created yet/, 'an empty seating plan is an empty state, not an error');
  });
});

test('the nav link on other admin pages points at a route that works', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);

    const rsvp = await request(port, { path: '/admin/rsvp', headers: { Cookie: cookie } });
    assert.match(rsvp.text, /href="\/admin\/table-arrangement"/, 'the nav advertises the route');

    const target = await request(port, { path: '/admin/table-arrangement', headers: { Cookie: cookie } });
    assert.equal(target.statusCode, 200, 'and the route it advertises answers');
  });
});

test('a table can be created and its seats offered to accepted guests', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);

    const created = await request(port, {
      path: '/api/admin/table-arrangement',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { tableNumber: 1, tableName: 'Head Table', capacity: 4 },
    });

    assert.equal(created.statusCode, 200);
    assert.equal(created.body.success, true);
    assert.equal(created.body.table.seats.length, 4);

    const list = await request(port, {
      path: '/api/admin/table-arrangement',
      headers: { Cookie: cookie },
    });
    assert.equal(list.body.tables.length, 1);
    assert.deepEqual(
      list.body.unassignedGuests.map((guest) => guest.name),
      ['Anula Gunasekara', 'Nimal Silva']
    );
  });
});

test('a duplicate table number is refused with a message, not a stack trace', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const payload = { tableNumber: 2, capacity: 2 };

    const first = await request(port, {
      path: '/api/admin/table-arrangement',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: payload,
    });
    assert.equal(first.statusCode, 200);

    const second = await request(port, {
      path: '/api/admin/table-arrangement',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: payload,
    });
    assert.equal(second.statusCode, 400);
    assert.equal(second.body.success, false);
    assert.match(second.body.message, /already exists/);
  });
});

test('seat assignment is rejected without a CSRF token', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);

    const created = await request(port, {
      path: '/api/admin/table-arrangement',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { tableNumber: 1, capacity: 2 },
    });
    const { id: tableId, seats } = created.body.table;

    const res = await request(port, {
      path: `/api/admin/table-arrangement/${tableId}/seats/${seats[0].id}/assign`,
      method: 'POST',
      headers: { Cookie: cookie },
      body: { guestId: 'g-seat-1' },
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.reason, 'csrf_invalid');
  });
});

test('the export downloads the seating plan for the events team', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);

    const created = await request(port, {
      path: '/api/admin/table-arrangement',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { tableNumber: 1, tableName: 'Head Table', capacity: 2 },
    });
    const { id: tableId, seats } = created.body.table;

    await request(port, {
      path: `/api/admin/table-arrangement/${tableId}/seats/${seats[0].id}/assign`,
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { guestId: 'g-seat-1', dietaryRequirements: 'vegetarian' },
    });

    const res = await request(port, {
      path: '/api/admin/table-arrangement/export',
      headers: { Cookie: cookie },
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.text, /Anula Gunasekara/);
    assert.match(res.text, /vegetarian/);
    assert.match(res.text, /Total Tables\t1/);
  });
});

// --- Probable attendance buffer (P1-16) --------------------------------------

test('the seating data includes the probable attendance buffer, both buckets at zero by default', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, { path: '/api/admin/table-arrangement', headers: { Cookie: cookie } });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.unassignedProbableAttendees, []);
    assert.deepEqual(res.body.probableAttendanceSummary, [
      { bucket: 'declined', bufferCount: 0, seatedCount: 0, unseatedCount: 0 },
      { bucket: 'pending', bufferCount: 0, seatedCount: 0, unseatedCount: 0 },
    ]);
  });
});

test('the buffer endpoint is admin-only and CSRF-gated', async () => {
  await withServer(async (port) => {
    const anon = await request(port, {
      path: '/api/admin/table-arrangement/probable-attendees',
      method: 'PUT',
      body: { bucket: 'declined', count: 2 },
    });
    assert.equal(anon.statusCode, 401);

    const cookie = await loginAdmin(port);
    const noCsrf = await request(port, {
      path: '/api/admin/table-arrangement/probable-attendees',
      method: 'PUT',
      headers: { Cookie: cookie },
      body: { bucket: 'declined', count: 2 },
    });
    assert.equal(noCsrf.statusCode, 403);
    assert.equal(noCsrf.body.reason, 'csrf_invalid');
  });
});

test('a buffer resize round-trips through the list endpoint', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);

    const resize = await request(port, {
      path: '/api/admin/table-arrangement/probable-attendees',
      method: 'PUT',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { bucket: 'declined', count: 2 },
    });
    assert.equal(resize.statusCode, 200);
    assert.equal(resize.body.success, true);

    const list = await request(port, { path: '/api/admin/table-arrangement', headers: { Cookie: cookie } });
    assert.deepEqual(
      list.body.unassignedProbableAttendees.map((p) => p.label),
      ['Probable (Declined) #1', 'Probable (Declined) #2']
    );
  });
});

test('an invalid bucket is rejected with a message, not a stack trace', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, {
      path: '/api/admin/table-arrangement/probable-attendees',
      method: 'PUT',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { bucket: 'maybe', count: 1 },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  });
});

test('a ProbableAttendee can be seated via the assign endpoint, and the buffer refuses to shrink below it', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const headers = { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) };

    await request(port, {
      path: '/api/admin/table-arrangement/probable-attendees',
      method: 'PUT',
      headers,
      body: { bucket: 'pending', count: 1 },
    });
    const { unassignedProbableAttendees } = (
      await request(port, { path: '/api/admin/table-arrangement', headers: { Cookie: cookie } })
    ).body;
    const [slot] = unassignedProbableAttendees;

    const created = await request(port, {
      path: '/api/admin/table-arrangement',
      method: 'POST',
      headers,
      body: { tableNumber: 1, capacity: 1 },
    });
    const { id: tableId, seats } = created.body.table;

    const assign = await request(port, {
      path: `/api/admin/table-arrangement/${tableId}/seats/${seats[0].id}/assign`,
      method: 'POST',
      headers,
      body: { probableAttendeeId: slot.id },
    });
    assert.equal(assign.statusCode, 200);
    assert.equal(assign.body.seat.probable_attendee_id, slot.id);

    const shrink = await request(port, {
      path: '/api/admin/table-arrangement/probable-attendees',
      method: 'PUT',
      headers,
      body: { bucket: 'pending', count: 0 },
    });
    assert.equal(shrink.statusCode, 400);
    assert.match(shrink.body.message, /already seated/);
  });
});

test('providing both guestId and probableAttendeeId to assign is rejected', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const headers = { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) };

    const created = await request(port, {
      path: '/api/admin/table-arrangement',
      method: 'POST',
      headers,
      body: { tableNumber: 1, capacity: 1 },
    });
    const { id: tableId, seats } = created.body.table;

    const res = await request(port, {
      path: `/api/admin/table-arrangement/${tableId}/seats/${seats[0].id}/assign`,
      method: 'POST',
      headers,
      body: { guestId: 'g-seat-1', probableAttendeeId: 'whatever' },
    });
    assert.equal(res.statusCode, 400);
  });
});

test('the export includes a ProbableAttendee-occupied seat with its placeholder label, no real name', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const headers = { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) };

    await request(port, {
      path: '/api/admin/table-arrangement/probable-attendees',
      method: 'PUT',
      headers,
      body: { bucket: 'declined', count: 1 },
    });
    const { unassignedProbableAttendees } = (
      await request(port, { path: '/api/admin/table-arrangement', headers: { Cookie: cookie } })
    ).body;
    const [slot] = unassignedProbableAttendees;

    const created = await request(port, {
      path: '/api/admin/table-arrangement',
      method: 'POST',
      headers,
      body: { tableNumber: 1, capacity: 1 },
    });
    const { id: tableId, seats } = created.body.table;

    await request(port, {
      path: `/api/admin/table-arrangement/${tableId}/seats/${seats[0].id}/assign`,
      method: 'POST',
      headers,
      body: { probableAttendeeId: slot.id },
    });

    const res = await request(port, { path: '/api/admin/table-arrangement/export', headers: { Cookie: cookie } });
    assert.equal(res.statusCode, 200);
    assert.match(res.text, /Probable \(Declined\) #1/);
  });
});
