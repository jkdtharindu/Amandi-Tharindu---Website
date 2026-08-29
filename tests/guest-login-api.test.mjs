import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';

beforeEach(() => {
  rsvpResponses.length = 0;
});

function requestJSON(options, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ ...options, headers: { ...(options.headers || {}), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let bodyText = '';
      res.on('data', (chunk) => (bodyText += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(bodyText || '{}');
        } catch (err) {
          return reject(err);
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function parseCookies(setCookieHeaders) {
  return (setCookieHeaders || []).map((header) => header.split(';')[0]).join('; ');
}

function csrfFromCookie(cookie) {
  const match = /csrf_token=([^;]+)/.exec(cookie || '');
  return match ? match[1] : '';
}

async function getCsrfCookie(port) {
  const page = await new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/login', method: 'GET' }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res));
    });
    req.end();
  });
  return parseCookies(page.headers['set-cookie'] || []);
}

test('POST /api/guest/login accepts code and returns a session', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const cookie = await getCsrfCookie(port);

  const result = await requestJSON(
    { hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': csrfFromCookie(cookie) } },
    { code: 'SILVA-001' }
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.guestId, 'guest-1');
  assert.ok(result.headers['set-cookie']?.length > 0, 'should set session cookie');

  await new Promise((resolve) => server.close(resolve));
});

test('POST /api/guest/login accepts exact name and returns a session', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const cookie = await getCsrfCookie(port);

  const result = await requestJSON(
    { hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': csrfFromCookie(cookie) } },
    { name: 'Nimal Silva' }
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.type, 'exact');
  assert.ok(result.body.guestId);

  await new Promise((resolve) => server.close(resolve));
});

test('POST /api/guest/login returns candidates for ambiguous name', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const cookie = await getCsrfCookie(port);

  const result = await requestJSON(
    { hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': csrfFromCookie(cookie) } },
    { name: 'Silva' }
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, false);
  assert.equal(result.body.type, 'candidates');
  assert.ok(Array.isArray(result.body.candidates));
  assert.ok(result.body.candidates.length >= 1);

  await new Promise((resolve) => server.close(resolve));
});

test('POST /api/guest/login returns 400 when missing code and name', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const cookie = await getCsrfCookie(port);

  const result = await requestJSON(
    { hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': csrfFromCookie(cookie) } },
    {}
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.success, false);
  assert.equal(result.body.reason, 'missing_identifier');

  await new Promise((resolve) => server.close(resolve));
});

test('POST /api/guest/rsvp accepts a response and returns success', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  // Wrapped in try/finally: without it a failed assertion skips server.close()
  // and leaves the listener open, so `node --test` hangs instead of reporting.
  try {
    const cookie = await getCsrfCookie(port);

    // Slice 18: the RSVP route now requires a guest session, so log in first and
    // carry the guest_session cookie the way a browser does.
    const login = await requestJSON(
      { hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': csrfFromCookie(cookie) } },
      { code: 'SILVA-001' }
    );
    assert.equal(login.statusCode, 200, 'login must succeed before RSVP');
    const sessionCookie = [cookie, parseCookies(login.headers['set-cookie'])].filter(Boolean).join('; ');

    const result = await requestJSON(
      { hostname: '127.0.0.1', port, path: '/api/guest/rsvp', method: 'POST', headers: { Cookie: sessionCookie, 'x-csrf-token': csrfFromCookie(cookie) } },
      {
        code: 'SILVA-001',
        attending: true,
        participantNames: ['Nimal Silva', 'Anu Silva'],
      }
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.rsvp.attending, true);
    assert.deepEqual(result.body.rsvp.participantNames, ['Nimal Silva', 'Anu Silva']);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
