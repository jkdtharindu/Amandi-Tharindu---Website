import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/password.js';
import { loginAdmin } from '../src/admin-auth/index.js';
import { createApp } from '../src/server.js';
import { startTestServer } from './helpers/test-server.mjs';

// --- Unit: password hashing ---

test('password: verifyPassword accepts the correct password', () => {
  const stored = hashPassword('correct-horse-battery-staple');
  assert.equal(verifyPassword('correct-horse-battery-staple', stored), true);
});

test('password: verifyPassword rejects an incorrect password', () => {
  const stored = hashPassword('correct-horse-battery-staple');
  assert.equal(verifyPassword('wrong-password', stored), false);
});

test('password: verifyPassword rejects malformed stored values', () => {
  assert.equal(verifyPassword('anything', 'not-a-valid-hash'), false);
  assert.equal(verifyPassword('anything', null), false);
  assert.equal(verifyPassword('anything', undefined), false);
});

test('password: two hashes of the same password differ (random salt)', () => {
  const a = hashPassword('same-password');
  const b = hashPassword('same-password');
  assert.notEqual(a, b);
  assert.equal(verifyPassword('same-password', a), true);
  assert.equal(verifyPassword('same-password', b), true);
});

// --- Unit: loginAdmin ---

test('loginAdmin: succeeds with the seeded dev admin credentials', async () => {
  const result = await loginAdmin('admin@example.com', 'change-me-now');
  assert.equal(result.success, true);
  assert.equal(result.email, 'admin@example.com');
  assert.ok(result.adminId);
});

test('loginAdmin: fails with wrong password using generic reason', async () => {
  const result = await loginAdmin('admin@example.com', 'wrong-password');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('loginAdmin: fails for unknown email with the SAME generic reason (no enumeration)', async () => {
  const result = await loginAdmin('nobody@example.com', 'anything-at-all');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('loginAdmin: fails when credentials are missing', async () => {
  const result = await loginAdmin('', '');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'missing_credentials');
});

// --- Integration: /api/admin/login, /api/admin/logout, /admin/dashboard ---

async function fetchCsrfToken(baseUrl) {
  const res = await fetch(`${baseUrl}/admin`);
  const cookies = res.headers.getSetCookie();
  const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
  if (!csrfCookie) throw new Error('Server did not issue a csrf_token cookie');
  const cookieHeader = csrfCookie.split(';')[0];
  const token = cookieHeader.split('=')[1];
  return { token, cookieHeader };
}

async function withTestApp(run) {
  const app = createApp();
  const server = await startTestServer(app);
  try {
    await run(server.baseUrl);
  } finally {
    await server.close();
  }
}

test('POST /api/admin/login rejects a request without a CSRF token', async () => {
  await withTestApp(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'change-me-now' }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.reason, 'csrf_invalid');
  });
});

test('POST /api/admin/login rejects wrong credentials with 401', async () => {
  await withTestApp(async (baseUrl) => {
    const { token, cookieHeader } = await fetchCsrfToken(baseUrl);
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ email: 'admin@example.com', password: 'wrong-password' }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.reason, 'invalid_credentials');
  });
});

test('POST /api/admin/login succeeds and sets an admin_session cookie', async () => {
  await withTestApp(async (baseUrl) => {
    const { token, cookieHeader } = await fetchCsrfToken(baseUrl);
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ email: 'admin@example.com', password: 'change-me-now' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const setCookies = res.headers.getSetCookie();
    assert.ok(setCookies.some((c) => c.startsWith('admin_session=')), 'should set admin_session cookie');
    assert.ok(setCookies.some((c) => c.includes('HttpOnly')), 'admin_session cookie should be HttpOnly');
  });
});

test('GET /admin/dashboard returns 401 JSON when not authenticated (API request)', async () => {
  await withTestApp(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Accept: 'application/json' },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.reason, 'admin_auth_required');
  });
});

test('GET /admin/dashboard redirects to /admin when not authenticated (browser request)', async () => {
  await withTestApp(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Accept: 'text/html' },
      redirect: 'manual',
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/admin');
  });
});

test('GET /admin/dashboard succeeds after logging in with the session cookie', async () => {
  await withTestApp(async (baseUrl) => {
    const { token, cookieHeader } = await fetchCsrfToken(baseUrl);
    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ email: 'admin@example.com', password: 'change-me-now' }),
    });
    const sessionCookie = loginRes.headers
      .getSetCookie()
      .find((c) => c.startsWith('admin_session='))
      .split(';')[0];

    const dashboardRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(dashboardRes.status, 200);
  });
});

test('GET /admin/dashboard rejects a guest_session cookie (no cross-role replay)', async () => {
  await withTestApp(async (baseUrl) => {
    const { token, cookieHeader } = await fetchCsrfToken(baseUrl);
    const guestLoginRes = await fetch(`${baseUrl}/api/guest/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ code: 'SILVA-001' }),
    });
    const guestSessionCookie = guestLoginRes.headers
      .getSetCookie()
      .find((c) => c.startsWith('guest_session='))
      .split(';')[0];

    const dashboardRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Accept: 'application/json', Cookie: guestSessionCookie },
    });
    assert.equal(dashboardRes.status, 401);
  });
});

test('Admin login is rate limited after repeated failures', async () => {
  await withTestApp(async (baseUrl) => {
    const { token, cookieHeader } = await fetchCsrfToken(baseUrl);
    const attempt = () =>
      fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
          Cookie: cookieHeader,
        },
        body: JSON.stringify({ email: 'admin@example.com', password: 'wrong-password' }),
      });

    let lastStatus;
    for (let i = 0; i < 6; i += 1) {
      const res = await attempt();
      lastStatus = res.status;
    }

    assert.equal(lastStatus, 429);
  });
});
