import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';

// An InvitationCode is printed on a card, so it is short, guessable, and cannot
// be rotated once the cards are posted. The counter exercised here is the only
// thing that makes walking the code space expensive.

const GUEST_LOGIN_LIMIT = 10;

function request(port, { path, method = 'GET', headers = {}, jsonBody }) {
  return new Promise((resolve, reject) => {
    let payload = null;
    const allHeaders = { ...headers };

    if (jsonBody !== undefined) {
      payload = Buffer.from(JSON.stringify(jsonBody));
      allHeaders['Content-Type'] = 'application/json';
      allHeaders['Content-Length'] = payload.length;
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
        resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
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

/** A fresh CSRF cookie/header pair, so requests fail on the code and not on CSRF. */
async function csrfHeaders(port, ip) {
  const landing = await request(port, { path: '/login', headers: { 'x-forwarded-for': ip } });
  const cookie = (landing.headers['set-cookie'] || []).map((header) => header.split(';')[0]).join('; ');
  const token = /csrf_token=([^;]+)/.exec(cookie)?.[1] ?? '';
  return { Cookie: cookie, 'x-csrf-token': token, 'x-forwarded-for': ip };
}

function attempt(port, headers, code) {
  return request(port, { path: '/api/guest/login', method: 'POST', headers, jsonBody: { code } });
}

test('a wrong code is refused normally right up to the limit', async () => {
  await withServer(async (port) => {
    const headers = await csrfHeaders(port, '203.0.113.10');

    for (let i = 1; i <= GUEST_LOGIN_LIMIT; i += 1) {
      const res = await attempt(port, headers, `NOPE-${i}`);
      assert.equal(res.statusCode, 404, `attempt ${i} should still be answered on its merits`);
    }
  });
});

test('the attempt after the limit is refused with 429 and a Retry-After', async () => {
  await withServer(async (port) => {
    const headers = await csrfHeaders(port, '203.0.113.11');

    for (let i = 1; i <= GUEST_LOGIN_LIMIT; i += 1) {
      await attempt(port, headers, `NOPE-${i}`);
    }

    const blocked = await attempt(port, headers, 'NOPE-OVER');
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.body.reason, 'too_many_attempts');
    assert(Number(blocked.headers['retry-after']) > 0, 'Retry-After should tell the caller when to come back');
  });
});

test('one exhausted client does not lock anybody else out', async () => {
  await withServer(async (port) => {
    const attacker = await csrfHeaders(port, '203.0.113.12');
    const guest = await csrfHeaders(port, '203.0.113.13');

    for (let i = 0; i <= GUEST_LOGIN_LIMIT; i += 1) {
      await attempt(port, attacker, `NOPE-${i}`);
    }

    assert.equal((await attempt(port, attacker, 'NOPE')).statusCode, 429, 'the exhausted client stays blocked');
    assert.equal((await attempt(port, guest, 'NOPE')).statusCode, 404, 'a different client is unaffected');
  });
});

test('a valid code still works while the limit has headroom', async () => {
  await withServer(async (port) => {
    const headers = await csrfHeaders(port, '203.0.113.14');

    await attempt(port, headers, 'NOPE-1');
    const res = await attempt(port, headers, 'SILVA-001');

    assert.equal(res.statusCode, 200, 'a real guest is not collateral damage of the counter');
    assert.equal(res.body.success, true);
  });
});
