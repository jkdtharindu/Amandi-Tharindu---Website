import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { themeSettings } from '../src/data/themeStore.js';

const DEFAULT_ADMIN = { email: 'admin@example.com', password: 'changeme123' };
const DEFAULTS = { ...themeSettings };

beforeEach(() => {
  Object.assign(themeSettings, DEFAULTS);
});

function request(options, body, cookie) {
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
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: bodyText }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseCookies(setCookieHeaders) {
  return (setCookieHeaders || []).map((header) => header.split(';')[0]).join('; ');
}

function csrfFromCookie(cookie) {
  const match = /csrf_token=([^;]+)/.exec(cookie);
  return match ? match[1] : '';
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

async function loginAsAdmin(port) {
  const csrfCookie = parseCookies(
    (await request({ hostname: '127.0.0.1', port, path: '/admin', method: 'GET' })).headers['set-cookie'] || []
  );
  const csrfToken = csrfFromCookie(csrfCookie);
  const loginResult = await request(
    { hostname: '127.0.0.1', port, path: '/api/admin/login', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
    DEFAULT_ADMIN,
    csrfCookie
  );
  const adminCookie = parseCookies(loginResult.headers['set-cookie'] || []);
  return { cookie: [csrfCookie, adminCookie].filter(Boolean).join('; '), csrfToken };
}

test('the theme editor renders swatches for all six approved palettes', async () => {
  await withServer(async (port) => {
    const { cookie } = await loginAsAdmin(port);
    const page = await request({ hostname: '127.0.0.1', port, path: '/admin/theme', method: 'GET' }, undefined, cookie);
    assert.equal(page.statusCode, 200);
    for (const name of ['Chateau Green', 'Imperial Gold', 'Rose Blush', 'Midnight Silver', 'Terracotta', 'Modern Royal Romance']) {
      assert.ok(page.body.includes(name), `expected the "${name}" palette swatch to render`);
    }
    assert.ok(page.body.includes('data-palette-id="modern-royal-romance"'), 'swatch should carry its palette id for the picker script');
    assert.ok(!page.body.includes('#C5A059'), 'the original, contrast-failing gold must never render — only the corrected #866D3D');
  });
});

test('the theme editor renders the curated font pairing list, each in its own face', async () => {
  await withServer(async (port) => {
    const { cookie } = await loginAsAdmin(port);
    const page = await request({ hostname: '127.0.0.1', port, path: '/admin/theme', method: 'GET' }, undefined, cookie);
    for (const font of ['Cormorant', 'Playfair', 'Cinzel', 'Inter']) {
      assert.ok(page.body.includes(font), `expected the "${font}" font option to render`);
    }
    assert.ok(page.body.includes("font-family:'Playfair Display'"), 'each option should render in its own font face');
  });
});

test('selecting the Modern Royal Romance palette cascades to the public home page', async () => {
  await withServer(async (port) => {
    const { cookie, csrfToken } = await loginAsAdmin(port);

    const saveResult = await request(
      { hostname: '127.0.0.1', port, path: '/api/admin/theme', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      { paletteName: 'modern-royal-romance' },
      cookie
    );
    assert.equal(saveResult.statusCode, 200);
    const saved = JSON.parse(saveResult.body);
    assert.equal(saved.settings.primaryColor, '#4A1525');
    assert.equal(saved.settings.accentColor, '#866D3D');

    const home = await request({ hostname: '127.0.0.1', port, path: '/home', method: 'GET' });
    assert.ok(home.body.includes('--color-primary: #4A1525'), 'burgundy should cascade to the public site CSS');
    assert.ok(home.body.includes('--color-accent: #866D3D'), 'the corrected gold should cascade to the public site CSS');
  });
});

test('an invalid paletteName is rejected and does not change the live theme', async () => {
  await withServer(async (port) => {
    const { cookie, csrfToken } = await loginAsAdmin(port);
    const result = await request(
      { hostname: '127.0.0.1', port, path: '/api/admin/theme', method: 'POST', headers: { 'x-csrf-token': csrfToken } },
      { paletteName: 'not-a-real-palette' },
      cookie
    );
    assert.equal(result.statusCode, 400);
    assert.equal(themeSettings.primaryColor, DEFAULTS.primaryColor);
  });
});
