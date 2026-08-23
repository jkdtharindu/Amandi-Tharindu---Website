import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { themeSettings } from '../src/data/themeStore.js';
import { siteSections } from '../src/data/sectionsStore.js';
import { guestStore } from '../src/data/guestStore.js';

const DEFAULT_ADMIN = { email: 'admin@example.com', password: 'changeme123' };
const ORIGINAL_GUESTS = structuredClone(guestStore);

beforeEach(() => {
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
    assert.match(createResult.body.guest.code, /^SILVA-\d{3}$/);
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
