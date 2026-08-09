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
    const req = http.request({ ...options, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
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

test('POST /api/guest/login accepts code and returns a session', async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const result = await requestJSON({ hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST' }, { code: 'SILVA-001' });

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

  const result = await requestJSON({ hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST' }, { name: 'Nimal Silva' });

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

  const result = await requestJSON({ hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST' }, { name: 'Silva' });

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

  const result = await requestJSON({ hostname: '127.0.0.1', port, path: '/api/guest/login', method: 'POST' }, {});

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

  const result = await requestJSON({ hostname: '127.0.0.1', port, path: '/api/guest/rsvp', method: 'POST' }, {
    code: 'SILVA-001',
    attending: true,
    participantNames: ['Nimal Silva', 'Anu Silva'],
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.rsvp.attending, true);
  assert.deepEqual(result.body.rsvp.participantNames, ['Nimal Silva', 'Anu Silva']);

  await new Promise((resolve) => server.close(resolve));
});
