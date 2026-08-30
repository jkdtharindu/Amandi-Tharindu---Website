import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';

beforeEach(() => {
  rsvpResponses.length = 0;
});

function requestJSON(options, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...extraHeaders,
        },
      },
      (res) => {
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
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function requestRaw(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      res.resume();
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetches a CSRF token by making a GET request first (the app issues the
 * csrf_token cookie on GET/HEAD), then returns the token plus the cookie
 * header needed to send it back.
 */
async function fetchCsrfToken(hostname, port) {
  const res = await requestRaw({ hostname, port, path: '/home', method: 'GET' });
  const setCookie = res.headers['set-cookie'] || [];
  const csrfCookie = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('csrf_token='));
  if (!csrfCookie) {
    throw new Error('Server did not issue a csrf_token cookie');
  }
  const token = csrfCookie.split('=')[1];
  return { token, cookieHeader: csrfCookie };
}

/**
 * Runs `fn` against a freshly created app/server pair, guaranteeing the
 * server is closed even if `fn` throws — an assertion failure must not
 * leak an open listener and hang the test process.
 */
async function withTestServer(fn) {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    await fn({ hostname: '127.0.0.1', port });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('POST /api/guest/login accepts code and returns a session', async () => {
  await withTestServer(async ({ hostname, port }) => {
    const { token, cookieHeader } = await fetchCsrfToken(hostname, port);
    const result = await requestJSON(
      { hostname, port, path: '/api/guest/login', method: 'POST' },
      { code: 'SILVA-001' },
      { 'x-csrf-token': token, Cookie: cookieHeader }
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.guestId, 'guest-1');
    assert.ok(result.headers['set-cookie']?.length > 0, 'should set session cookie');
  });
});

test('POST /api/guest/login accepts exact name and returns a session', async () => {
  await withTestServer(async ({ hostname, port }) => {
    const { token, cookieHeader } = await fetchCsrfToken(hostname, port);
    const result = await requestJSON(
      { hostname, port, path: '/api/guest/login', method: 'POST' },
      { name: 'Nimal Silva' },
      { 'x-csrf-token': token, Cookie: cookieHeader }
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.type, 'exact');
    assert.ok(result.body.guestId);
  });
});

test('POST /api/guest/login returns candidates for ambiguous name', async () => {
  await withTestServer(async ({ hostname, port }) => {
    const { token, cookieHeader } = await fetchCsrfToken(hostname, port);
    const result = await requestJSON(
      { hostname, port, path: '/api/guest/login', method: 'POST' },
      { name: 'Silva' },
      { 'x-csrf-token': token, Cookie: cookieHeader }
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, false);
    assert.equal(result.body.type, 'candidates');
    assert.ok(Array.isArray(result.body.candidates));
    assert.ok(result.body.candidates.length >= 1);
  });
});

test('POST /api/guest/login returns 400 when missing code and name', async () => {
  await withTestServer(async ({ hostname, port }) => {
    const { token, cookieHeader } = await fetchCsrfToken(hostname, port);
    const result = await requestJSON(
      { hostname, port, path: '/api/guest/login', method: 'POST' },
      {},
      { 'x-csrf-token': token, Cookie: cookieHeader }
    );

    assert.equal(result.statusCode, 400);
    assert.equal(result.body.success, false);
    assert.equal(result.body.reason, 'missing_identifier');
  });
});

test('POST /api/guest/login rejects requests without a valid CSRF token', async () => {
  await withTestServer(async ({ hostname, port }) => {
    const result = await requestJSON(
      { hostname, port, path: '/api/guest/login', method: 'POST' },
      { code: 'SILVA-001' }
    );

    assert.equal(result.statusCode, 403);
    assert.equal(result.body.reason, 'csrf_invalid');
  });
});

test('POST /api/guest/rsvp accepts a response and returns success', async () => {
  await withTestServer(async ({ hostname, port }) => {
    const { token, cookieHeader } = await fetchCsrfToken(hostname, port);
    const result = await requestJSON(
      { hostname, port, path: '/api/guest/rsvp', method: 'POST' },
      {
        code: 'SILVA-001',
        attending: true,
        participantNames: ['Nimal Silva', 'Anu Silva'],
      },
      { 'x-csrf-token': token, Cookie: cookieHeader }
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.rsvp.attending, true);
    assert.deepEqual(result.body.rsvp.participantNames, ['Nimal Silva', 'Anu Silva']);
  });
});
