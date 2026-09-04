import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { themeSettings } from '../src/data/themeStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';

const DEFAULTS = { ...themeSettings };

beforeEach(() => {
  Object.assign(themeSettings, DEFAULTS);
  rsvpResponses.length = 0;
});

function getPage(port, path, cookie = '') {
  return new Promise((resolve, reject) => {
    const headers = cookie ? { Cookie: cookie } : {};
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function postJSON(port, path, cookie, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const csrf = /csrf_token=([^;]+)/.exec(cookie || '');
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          Cookie: cookie,
          'x-csrf-token': csrf ? csrf[1] : '',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function cookiesFrom(res) {
  return (res.headers['set-cookie'] || []).map((header) => header.split(';')[0]).join('; ');
}

/**
 * Slice 18: the invitation page now requires a guest session, so every test
 * here signs in first and passes the resulting cookie jar — the same two steps
 * a real guest takes. Access control itself is covered in guest-session.test.mjs.
 */
async function loginAs(port, code) {
  const landing = await new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/login', method: 'GET' }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res));
    });
    req.on('error', reject);
    req.end();
  });

  const csrfCookie = (landing.headers['set-cookie'] || []).map((h) => h.split(';')[0]).join('; ');
  const login = await postJSON(port, '/api/guest/login', csrfCookie, { code });
  return [csrfCookie, cookiesFrom(login)].filter(Boolean).join('; ');
}

async function withServer(fn) {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('REGRESSION: invitation page defines getCookieValue before using it', async () => {
  // The RSVP submit handler calls getCookieValue() for the CSRF token. That
  // helper was previously only defined on the login and admin pages, so the
  // button threw ReferenceError and no guest could submit an RSVP from a browser.
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await getPage(port, '/invitation/SILVA-001', cookie);
    assert.ok(page.body.includes('getCookieValue('), 'page uses getCookieValue');
    assert.ok(
      page.body.includes('function getCookieValue'),
      'page must also DEFINE getCookieValue, or the RSVP button throws ReferenceError'
    );
    const definedAt = page.body.indexOf('function getCookieValue');
    const usedAt = page.body.indexOf("getCookieValue('csrf_token')");
    assert.ok(definedAt < usedAt, 'definition must appear before use');
  });
});

test('invitation page uses the shared site shell and theme', async () => {
  themeSettings.primaryColor = '#654321';
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await getPage(port, '/invitation/SILVA-001', cookie);
    assert.equal(page.statusCode, 200);
    assert.ok(page.body.includes('--color-primary: #654321'), 'theme colours apply to the invitation page');
    assert.ok(page.body.includes('class="site-nav"'), 'invitation page shares the site navigation');
    assert.ok(!page.body.includes('font-family: system-ui, sans-serif'), 'orphaned inline styling should be gone');
  });
});

test('P0-02: InvitationTemplate renders with the name overlay from ThemeSettings', async () => {
  themeSettings.invitationTemplateUrl = 'https://example.com/card.jpg';
  themeSettings.invitationNameTop = '61%';
  themeSettings.invitationNameLeft = '52%';
  themeSettings.invitationNameFontSize = '3rem';
  themeSettings.invitationNameColor = '#5C3317';

  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await getPage(port, '/invitation/SILVA-001', cookie);
    assert.ok(page.body.includes('https://example.com/card.jpg'), 'template image renders');
    assert.ok(page.body.includes('top: 61%'), 'overlay top position comes from settings');
    assert.ok(page.body.includes('left: 52%'), 'overlay left position comes from settings');
    assert.ok(page.body.includes('font-size: 3rem'), 'overlay font size comes from settings');
    assert.ok(page.body.includes('color: #5C3317'), 'overlay colour comes from settings');
    assert.ok(page.body.includes('Nimal Silva'), 'the guest name is overlaid');
  });
});

test('a graceful fallback renders when no InvitationTemplate is configured', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await getPage(port, '/invitation/SILVA-001', cookie);
    assert.ok(page.body.includes('invitation-fallback'), 'fallback card renders');
    assert.ok(page.body.includes('Nimal Silva'), 'guest name still shown');
  });
});

test('sticky RSVP bar shows while pending and hides once responded', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const pending = await getPage(port, '/invitation/SILVA-001', cookie);
    assert.ok(/id="sticky-bar" class="sticky-bar "/.test(pending.body), 'bar visible while pending');

    rsvpResponses.push({
      guestId: 'guest-1',
      attending: true,
      participantNames: ['Nimal Silva'],
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const answered = await getPage(port, '/invitation/SILVA-001', cookie);
    assert.ok(answered.body.includes('id="sticky-bar" class="sticky-bar hidden"'), 'bar hidden after responding');
    assert.ok(answered.body.includes('Change your response'), 'change-response option appears');
  });
});

test('unknown invitation code returns a styled 404, not a bare heading', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await getPage(port, '/invitation/NOPE-999', cookie);
    assert.equal(page.statusCode, 404);
    assert.ok(page.body.includes('class="site-nav"'), '404 uses the site shell');
    assert.ok(page.body.includes('Find your invitation'), 'offers a way forward');
  });
});

test('soft-deleted guests cannot reach an invitation page', async () => {
  await withServer(async (port) => {
    const cookie = await loginAs(port, 'SILVA-001');
    const page = await getPage(port, '/invitation/SILVA-002', cookie);
    assert.equal(page.statusCode, 404, 'soft-deleted guest must not resolve');
  });
});
