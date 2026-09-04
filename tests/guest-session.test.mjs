import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { guestStore } from '../src/data/guestStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';

// Slice 18 — guest session enforcement.
//
// Until this slice, holding a valid InvitationCode was enough to read another
// family's invitation and to overwrite their RSVP: the `guest_session` cookie
// was set at login and then never read by any route. These tests pin the fixed
// behaviour — the code identifies WHICH invitation, the session proves the
// visitor is entitled to it.

const SECOND_GUEST = {
  id: 'guest-3',
  code: 'PERERA-010',
  name: 'Sunil Perera',
  relationship: 'Colleague',
  slotCount: 2,
  whatsappNumber: null,
  email: null,
  rsvpStatus: 'pending',
  isDeleted: false,
  hasVisited: false,
};

beforeEach(() => {
  rsvpResponses.length = 0;
  guestStore.push({ ...SECOND_GUEST });
});

afterEach(() => {
  const index = guestStore.findIndex((guest) => guest.id === SECOND_GUEST.id);
  if (index !== -1) guestStore.splice(index, 1);
  rsvpResponses.length = 0;
});

async function withServer(fn) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

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

function mergeCookies(existing, setCookieHeaders) {
  const jar = new Map();
  for (const pair of String(existing || '').split('; ').filter(Boolean)) {
    const [name, ...rest] = pair.split('=');
    jar.set(name, rest.join('='));
  }
  for (const header of setCookieHeaders || []) {
    const [name, ...rest] = header.split(';')[0].split('=');
    jar.set(name, rest.join('='));
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

function csrfFrom(cookie) {
  const match = /csrf_token=([^;]+)/.exec(cookie || '');
  return match ? match[1] : '';
}

/** Fetches /login to obtain a CSRF cookie, exactly as a browser would. */
async function startSession(port) {
  const page = await request(port, { path: '/login' });
  return mergeCookies('', page.headers['set-cookie']);
}

/** Logs a guest in through the real API and returns the full cookie jar. */
async function loginAs(port, code) {
  const cookie = await startSession(port);
  const res = await request(port, {
    path: '/api/guest/login',
    method: 'POST',
    headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
    body: { code },
  });
  assert.equal(res.statusCode, 200, `login for ${code} should succeed`);
  return mergeCookies(cookie, res.headers['set-cookie']);
}

test('SECURITY: /invitation/:code redirects to login without a guest session', async () => {
  await withServer(async (port) => {
    const page = await request(port, { path: '/invitation/SILVA-001' });

    assert.equal(page.statusCode, 302, 'a bare code must no longer render the invitation');
    assert.equal(page.headers.location, '/login');
    assert.ok(!page.text.includes('Nimal Silva'), 'the guest name must not leak in the redirect body');
  });
});

test('a logged-in guest can read their own invitation', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await request(port, { path: '/invitation/SILVA-001', headers: { Cookie: cookie } });

    assert.equal(page.statusCode, 200);
    assert.ok(page.text.includes('Nimal Silva'), 'their own name still renders');
  });
});

test("SECURITY: a guest cannot read another guest's invitation with a shared code", async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await request(port, { path: '/invitation/PERERA-010', headers: { Cookie: cookie } });

    assert.equal(page.statusCode, 403, 'a forwarded code must not open another family invitation');
    assert.ok(!page.text.includes('Sunil Perera'), "the other guest's name must not leak");
  });
});

test('a tampered or unknown session cookie is rejected, not trusted', async () => {
  await withServer(async (port) => {
    for (const forged of ['guest-does-not-exist', 'guest-1.deadbeef', '../../etc/passwd', '']) {
      const page = await request(port, {
        path: '/invitation/SILVA-001',
        headers: { Cookie: `guest_session=${forged}` },
      });
      assert.equal(page.statusCode, 302, `forged session "${forged}" must not be accepted`);
      assert.equal(page.headers.location, '/login');
    }
  });
});

test("a soft-deleted guest's existing session stops working", async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'PERERA-010');
    const before = await request(port, { path: '/invitation/PERERA-010', headers: { Cookie: cookie } });
    assert.equal(before.statusCode, 200, 'sanity: the session works while the guest is active');

    guestStore.find((guest) => guest.id === SECOND_GUEST.id).isDeleted = true;

    const after = await request(port, { path: '/invitation/PERERA-010', headers: { Cookie: cookie } });
    assert.equal(after.statusCode, 302, 'removing a guest must revoke their access immediately');
  });
});

test('an unknown code still 404s for a logged-in guest', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await request(port, { path: '/invitation/NOPE-999', headers: { Cookie: cookie } });

    assert.equal(page.statusCode, 404);
    assert.ok(page.text.includes('Find your invitation'), 'the 404 still offers a way forward');
  });
});

test('SECURITY: POST /api/guest/rsvp is rejected without a guest session', async () => {
  await withServer(async (port) => {
    const cookie = await startSession(port);
    const res = await request(port, {
      path: '/api/guest/rsvp',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { code: 'SILVA-001', attending: true, participantNames: ['Nimal Silva'] },
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.reason, 'not_authenticated');
    assert.equal(rsvpResponses.length, 0, 'no RSVP may be recorded for an unauthenticated caller');
  });
});

test("SECURITY: a guest cannot overwrite another guest's RSVP", async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const res = await request(port, {
      path: '/api/guest/rsvp',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { code: 'PERERA-010', attending: false },
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.reason, 'not_your_invitation');
    assert.equal(
      rsvpResponses.find((entry) => entry.guestId === SECOND_GUEST.id),
      undefined,
      "the other guest's RSVP must be untouched"
    );
  });
});

test('a logged-in guest can submit their own RSVP', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const res = await request(port, {
      path: '/api/guest/rsvp',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { code: 'SILVA-001', attending: true, participantNames: ['Nimal Silva', 'Anu Silva'] },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.rsvp.participantNames, ['Nimal Silva', 'Anu Silva']);
  });
});

test('the RSVP route still enforces CSRF for a logged-in guest', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const res = await request(port, {
      path: '/api/guest/rsvp',
      method: 'POST',
      headers: { Cookie: cookie },
      body: { code: 'SILVA-001', attending: true, participantNames: ['Nimal Silva'] },
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.reason, 'csrf_invalid');
  });
});
