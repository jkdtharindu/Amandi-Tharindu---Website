import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';
import { TEST_ADMIN, seedTestAdmin } from './helpers/adminFixture.mjs';

// Slice 18 follow-up — guest logout.
//
// Once /invitation/:code started requiring a session, a guest had no way to
// release it. Sri Lankan guests commonly share one phone within a family, so
// handing the device to the next person has to be possible without clearing
// browser cookies by hand.

beforeEach(() => {
  seedTestAdmin();
  rsvpResponses.length = 0;
});

afterEach(() => {
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

async function startSession(port) {
  const page = await request(port, { path: '/login' });
  return mergeCookies('', page.headers['set-cookie']);
}

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

test('POST /api/guest/logout clears the session and ends access', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');

    const before = await request(port, { path: '/invitation/SILVA-001', headers: { Cookie: cookie } });
    assert.equal(before.statusCode, 200, 'sanity: the session works before logout');

    const res = await request(port, {
      path: '/api/guest/logout',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    // Apply the Set-Cookie the server sent back, exactly as a browser would,
    // then confirm the session is genuinely gone rather than merely unused.
    const afterCookie = mergeCookies(cookie, res.headers['set-cookie']);
    const after = await request(port, { path: '/invitation/SILVA-001', headers: { Cookie: afterCookie } });

    assert.equal(after.statusCode, 302, 'the invitation must be closed again after logout');
    assert.equal(after.headers.location, '/login');
  });
});

test('logout requires a CSRF token', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const res = await request(port, { path: '/api/guest/logout', method: 'POST', headers: { Cookie: cookie } });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.reason, 'csrf_invalid');

    const still = await request(port, { path: '/invitation/SILVA-001', headers: { Cookie: cookie } });
    assert.equal(still.statusCode, 200, 'a rejected logout must not sign the guest out anyway');
  });
});

test('logout is idempotent — signing out twice is not an error', async () => {
  await withServer(async (port) => {
    const cookie = await startSession(port);

    // No guest session at all: a guest whose cookie already expired should get
    // a clean result, not a confusing failure, when they tap "Sign out".
    const res = await request(port, {
      path: '/api/guest/logout',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  });
});

test('logout does not disturb an admin session', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');

    const adminLogin = await request(port, {
      path: '/api/admin/login',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
    });
    assert.equal(adminLogin.statusCode, 200, 'sanity: the seeded test admin can log in');

    const bothCookie = mergeCookies(cookie, adminLogin.headers['set-cookie']);
    const logout = await request(port, {
      path: '/api/guest/logout',
      method: 'POST',
      headers: { Cookie: bothCookie, 'x-csrf-token': csrfFrom(bothCookie) },
    });
    const afterCookie = mergeCookies(bothCookie, logout.headers['set-cookie']);

    const adminPage = await request(port, { path: '/admin/guests', headers: { Cookie: afterCookie } });
    assert.equal(adminPage.statusCode, 200, 'guest logout must not sign the admin out too');
  });
});

test('the invitation page offers a visible way to sign out', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await request(port, { path: '/invitation/SILVA-001', headers: { Cookie: cookie } });

    assert.ok(page.text.includes('id="sign-out"'), 'a sign-out control must exist on the page');
    assert.ok(page.text.includes('/api/guest/logout'), 'and it must call the logout endpoint');

    // The earlier P0 on this page was a handler calling an undefined helper, so
    // pin the same class of mistake for the sign-out handler.
    const definedAt = page.text.indexOf('function getCookieValue');
    const usedAt = page.text.indexOf("'/api/guest/logout'");
    assert.ok(definedAt !== -1 && definedAt < usedAt, 'getCookieValue must be defined before the sign-out handler uses it');
  });
});
