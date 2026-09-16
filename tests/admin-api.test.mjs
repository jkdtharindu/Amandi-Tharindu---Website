import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { themeSettings } from '../src/data/themeStore.js';
import { siteSections } from '../src/data/sectionsStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { TEST_ADMIN, seedTestAdmin } from './helpers/adminFixture.mjs';

const DEFAULT_ADMIN = { email: TEST_ADMIN.email, password: TEST_ADMIN.password };
const ORIGINAL_GUESTS = structuredClone(guestStore);

beforeEach(() => {
  seedTestAdmin();
  siteSections.length = 0;
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS));
});

function requestJSON({ options, body, cookie }) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = { ...(options.headers || {}) };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request({ ...options, headers }, (res) => {
      let bodyText = '';
      res.on('data', (chunk) => (bodyText += chunk));
      res.on('end', () => {
        let parsed = {};
        try {
          parsed = bodyText ? JSON.parse(bodyText) : {};
        } catch (err) {
          return reject(err);
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseCookies(setCookieHeaders) {
  return (setCookieHeaders || []).map((header) => header.split(';')[0]).join('; ');
}

async function withServer(fn) {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    await fn(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function getCsrfCookie(port) {
  const page = await new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/admin', method: 'GET' }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res));
    });
    req.end();
  });
  return parseCookies(page.headers['set-cookie'] || []);
}

function csrfFromCookie(cookie) {
  const match = /csrf_token=([^;]+)/.exec(cookie);
  return match ? match[1] : '';
}

test('POST /api/admin/login rejects wrong credentials', async () => {
  await withServer(async (port) => {
    const cookie = await getCsrfCookie(port);
    const result = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/login', method: 'POST', headers: { 'x-csrf-token': csrfFromCookie(cookie) } },
      body: { email: DEFAULT_ADMIN.email, password: 'wrong' },
      cookie,
    });
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.success, false);
  });
});

// Until Next Action 28 this route had no limit at all: the admin password was
// the only thing protecting the whole guest list, and it could be guessed at
// unlimited speed. createAdminLoginLimiter() allows 8 attempts per 15 minutes.
test('POST /api/admin/login throttles repeated wrong passwords with a 429', async () => {
  await withServer(async (port) => {
    const cookie = await getCsrfCookie(port);
    const attempt = () =>
      requestJSON({
        options: { hostname: '127.0.0.1', port, path: '/api/admin/login', method: 'POST', headers: { 'x-csrf-token': csrfFromCookie(cookie) } },
        body: { email: DEFAULT_ADMIN.email, password: 'wrong' },
        cookie,
      });

    for (let i = 0; i < 8; i += 1) {
      const result = await attempt();
      assert.equal(result.statusCode, 401, `attempt ${i + 1} should still be allowed through`);
    }

    const blocked = await attempt();
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.body.reason, 'too_many_attempts');
    assert.ok(blocked.headers['retry-after'], 'a throttled reply should say when to retry');
  });
});

test('a successful admin login clears the throttle counter', async () => {
  await withServer(async (port) => {
    const cookie = await getCsrfCookie(port);
    const post = (body) =>
      requestJSON({
        options: { hostname: '127.0.0.1', port, path: '/api/admin/login', method: 'POST', headers: { 'x-csrf-token': csrfFromCookie(cookie) } },
        body,
        cookie,
      });

    for (let i = 0; i < 5; i += 1) {
      await post({ email: DEFAULT_ADMIN.email, password: 'wrong' });
    }

    const good = await post(DEFAULT_ADMIN);
    assert.equal(good.statusCode, 200);

    // Without the reset, five earlier misses plus these would cross the limit.
    for (let i = 0; i < 6; i += 1) {
      const result = await post({ email: DEFAULT_ADMIN.email, password: 'wrong' });
      assert.equal(result.statusCode, 401, 'counter should have restarted after the successful login');
    }
  });
});

test('admin login, theme update, and section CRUD flow', async () => {
  await withServer(async (port) => {
    const csrfCookie = await getCsrfCookie(port);
    const csrfToken = csrfFromCookie(csrfCookie);

    const loginResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/login', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      body: DEFAULT_ADMIN,
      cookie: csrfCookie,
    });
    assert.equal(loginResult.statusCode, 200);
    assert.equal(loginResult.body.success, true);

    const adminCookie = parseCookies(loginResult.headers['set-cookie'] || []);
    const allCookies = [csrfCookie, adminCookie].filter(Boolean).join('; ');

    const themeResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/theme', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      body: { heroImageUrl: 'https://example.com/hero.jpg', primaryColor: '#123456' },
      cookie: allCookies,
    });
    assert.equal(themeResult.statusCode, 200);
    assert.equal(themeResult.body.success, true);
    assert.equal(themeResult.body.settings.heroImageUrl, 'https://example.com/hero.jpg');
    assert.equal(themeSettings.heroImageUrl, 'https://example.com/hero.jpg');

    const createResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/sections', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      body: { page: 'home', sectionType: 'text', title: 'Extra note' },
      cookie: allCookies,
    });
    assert.equal(createResult.statusCode, 200);
    const sectionId = createResult.body.section.id;

    const patchResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: `/api/admin/sections/${sectionId}`, method: 'PATCH', headers: { 'x-csrf-token': csrfToken } },
      body: { isVisible: false },
      cookie: allCookies,
    });
    assert.equal(patchResult.statusCode, 200);
    assert.equal(patchResult.body.section.isVisible, false);

    const deleteResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: `/api/admin/sections/${sectionId}`, method: 'DELETE', headers: { 'x-csrf-token': csrfToken } },
      cookie: allCookies,
    });
    assert.equal(deleteResult.statusCode, 200);
    assert.equal(deleteResult.body.success, true);
  });
});

test('theme and section admin endpoints reject unauthenticated requests', async () => {
  await withServer(async (port) => {
    const csrfCookie = await getCsrfCookie(port);
    const csrfToken = csrfFromCookie(csrfCookie);

    const themeResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/theme', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      body: { heroImageUrl: 'https://example.com/x.jpg' },
      cookie: csrfCookie,
    });
    assert.equal(themeResult.statusCode, 401);

    const sectionsResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/sections', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      body: { page: 'home', sectionType: 'text' },
      cookie: csrfCookie,
    });
    assert.equal(sectionsResult.statusCode, 401);
  });
});

test('admin guest management create, update, list, and soft-delete flow', async () => {
  await withServer(async (port) => {
    const csrfCookie = await getCsrfCookie(port);
    const csrfToken = csrfFromCookie(csrfCookie);

    const loginResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/login', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      body: DEFAULT_ADMIN,
      cookie: csrfCookie,
    });
    const adminCookie = parseCookies(loginResult.headers['set-cookie'] || []);
    const allCookies = [csrfCookie, adminCookie].filter(Boolean).join('; ');

    const createResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/guests', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      body: { name: 'Admin Test Silva', relationship: 'Relations', slotCount: 2 },
      cookie: allCookies,
    });
    assert.equal(createResult.statusCode, 200);
    assert.equal(createResult.body.success, true);
    assert.match(createResult.body.guest.code, /^ADMIN-\d{3}$/, 'first name token of \"Admin Test Silva\"');
    const guestId = createResult.body.guest.id;

    const listResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/guests?search=Admin%20Test', method: 'GET' },
      cookie: allCookies,
    });
    assert.equal(listResult.statusCode, 200);
    assert.ok(listResult.body.guests.some((guest) => guest.id === guestId));

    const patchResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: `/api/admin/guests/${guestId}`, method: 'PATCH', headers: { 'x-csrf-token': csrfToken } },
      body: { slotCount: 3 },
      cookie: allCookies,
    });
    assert.equal(patchResult.statusCode, 200);
    assert.equal(patchResult.body.guest.slotCount, 3);

    const deleteResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: `/api/admin/guests/${guestId}`, method: 'DELETE', headers: { 'x-csrf-token': csrfToken } },
      cookie: allCookies,
    });
    assert.equal(deleteResult.statusCode, 200);
    assert.equal(deleteResult.body.guest.isDeleted, true);
  });
});

test('guest admin endpoints reject unauthenticated requests', async () => {
  await withServer(async (port) => {
    const csrfCookie = await getCsrfCookie(port);
    const csrfToken = csrfFromCookie(csrfCookie);

    const listResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/guests', method: 'GET' },
      cookie: csrfCookie,
    });
    assert.equal(listResult.statusCode, 401);

    const createResult = await requestJSON({
      options: { hostname: '127.0.0.1', port, path: '/api/admin/guests', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      body: { name: 'Blocked Guest', relationship: 'Friends', slotCount: 1 },
      cookie: csrfCookie,
    });
    assert.equal(createResult.statusCode, 401);
  });
});
