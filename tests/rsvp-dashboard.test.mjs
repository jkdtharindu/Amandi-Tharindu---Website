import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { guestStore } from '../src/data/guestStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';

// Slice 19 — Admin RSVP Dashboard (P0-08).

const DEFAULT_ADMIN = { email: 'admin@example.com', password: 'changeme123' };
const ORIGINAL_GUESTS = structuredClone(guestStore);

const EXTRA_GUESTS = [
  {
    id: 'g-acc',
    code: 'ACC-001',
    name: 'Accepting Family',
    relationship: 'Relations',
    slotCount: 4,
    whatsappNumber: null,
    email: null,
    rsvpStatus: 'accepted',
    isDeleted: false,
    hasVisited: true,
  },
  {
    id: 'g-dec',
    code: 'DEC-001',
    name: 'Declining Family',
    relationship: 'Friends',
    slotCount: 2,
    whatsappNumber: null,
    email: null,
    rsvpStatus: 'declined',
    isDeleted: false,
    hasVisited: true,
  },
];

beforeEach(() => {
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS), ...structuredClone(EXTRA_GUESTS));
  rsvpResponses.length = 0;
  rsvpResponses.push(
    { guestId: 'g-acc', attending: true, participantNames: ['A One', 'A Two', 'A Three'] },
    { guestId: 'g-dec', attending: false, participantNames: [] }
  );
});

afterEach(() => {
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS));
  rsvpResponses.length = 0;
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

test('the dashboard and its data are admin-only', async () => {
  await withServer(async (port) => {
    const page = await request(port, { path: '/admin/rsvp' });
    assert.equal(page.statusCode, 302, 'the page redirects when signed out');
    assert.equal(page.headers.location, '/admin');

    const stats = await request(port, { path: '/api/admin/dashboard' });
    assert.equal(stats.statusCode, 401, 'the stats API must not be public');

    const csv = await request(port, { path: '/api/admin/dashboard/export' });
    assert.equal(csv.statusCode, 401, 'the guest list must not be downloadable while signed out');
  });
});

test('GET /api/admin/dashboard returns the P0-08 figures', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, { path: '/api/admin/dashboard', headers: { Cookie: cookie } });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    const stats = res.body.stats;
    // Seed data: SILVA-001 pending, SILVA-002 soft-deleted, plus the two above.
    assert.equal(stats.totalInvited, 3, 'the soft-deleted seed guest is excluded');
    assert.equal(stats.acceptedFamilies, 1);
    assert.equal(stats.acceptedHeadcount, 3);
    assert.equal(stats.declinedFamilies, 1);
    assert.equal(stats.pendingFamilies, 1);
  });
});

test('the dashboard renders the headline numbers and a chart', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const page = await request(port, { path: '/admin/rsvp', headers: { Cookie: cookie } });

    assert.equal(page.statusCode, 200);
    assert.match(page.text, /Total Invited/i);
    assert.match(page.text, /Accepted/i);
    assert.match(page.text, /Declined/i);
    assert.match(page.text, /Pending/i);
    assert.match(page.text, /Headcount/i);

    assert.ok(page.text.includes('<svg'), 'a visual chart must be rendered, per P0-08');
    assert.ok(
      !page.text.includes('cdn.') && !page.text.includes('unpkg') && !page.text.includes('chart.js'),
      'the chart must be self-hosted — the site must not depend on a third-party CDN'
    );
  });
});

test('the chart is server-rendered, so it is correct before any script runs', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const page = await request(port, { path: '/admin/rsvp', headers: { Cookie: cookie } });

    // The bars must reflect real data in the initial HTML, not appear only
    // after a fetch — otherwise the page is blank on a slow connection.
    const chart = page.text.slice(page.text.indexOf('<svg'), page.text.indexOf('</svg>'));
    assert.match(chart, /Accepted/i, 'bars are labelled in the served markup');
    assert.ok(/\d/.test(chart), 'and carry real numbers');
  });
});

test('the dashboard refreshes itself without a manual reload', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const page = await request(port, { path: '/admin/rsvp', headers: { Cookie: cookie } });

    assert.ok(page.text.includes('/api/admin/dashboard'), 'the page polls the stats endpoint');
    assert.ok(/setInterval/.test(page.text), 'P0-08 requires data to be real-time with no manual refresh');
  });
});

test('GET /api/admin/dashboard/export downloads the guest list', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, { path: '/api/admin/dashboard/export', headers: { Cookie: cookie } });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(
      res.headers['content-disposition'],
      /attachment; filename=/,
      'it must download as a file rather than render in the browser'
    );

    const lines = res.text.trim().split('\n');
    assert.match(lines[0], /Name,Code/, 'header row first');
    assert.ok(res.text.includes('Accepting Family'), 'accepted guests appear');
    assert.ok(res.text.includes('"A One, A Two, A Three"'), 'participant names are exported and quoted');
    assert.ok(res.text.includes('Nimal Silva'), 'pending guests appear too');
  });
});

test('the dashboard reflects a newly submitted RSVP', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);

    const before = await request(port, { path: '/api/admin/dashboard', headers: { Cookie: cookie } });
    assert.equal(before.body.stats.pendingFamilies, 1);

    // The remaining pending seed guest responds.
    rsvpResponses.push({ guestId: 'guest-1', attending: true, participantNames: ['Nimal Silva', 'Anu Silva'] });

    const after = await request(port, { path: '/api/admin/dashboard', headers: { Cookie: cookie } });
    assert.equal(after.body.stats.pendingFamilies, 0, 'the figure must not be cached');
    assert.equal(after.body.stats.acceptedFamilies, 2);
    assert.equal(after.body.stats.acceptedHeadcount, 5, '3 + 2');
  });
});

test('the admin nav links to the dashboard', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const page = await request(port, { path: '/admin/guests', headers: { Cookie: cookie } });
    assert.ok(page.text.includes('href="/admin/rsvp"'), 'the dashboard must be reachable from other admin pages');
  });
});
