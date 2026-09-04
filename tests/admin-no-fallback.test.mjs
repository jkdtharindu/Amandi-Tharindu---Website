import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import http from 'http';
import { createApp } from '../src/server.js';
import { adminStore, isAdminConfigured } from '../src/data/adminStore.js';
import { seedTestAdmin, clearTestAdmin } from './helpers/adminFixture.mjs';

// The dev fallback admin password was removed on 2026-08-29. It was safe in the
// sense that production refused to boot without ADMIN_EMAIL/ADMIN_PASSWORD_HASH,
// but the password sat in a public repository and would have granted admin on
// any deployment where NODE_ENV was not exactly 'production'.
//
// These tests exist so it cannot come back by accident.

const execFile = promisify(execFileCb);

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(PROJECT_ROOT, '..', 'src');

beforeEach(() => {
  clearTestAdmin();
});

afterEach(() => {
  seedTestAdmin();
});

function request(port, { path: urlPath, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const allHeaders = { ...headers };
    if (payload) {
      allHeaders['Content-Type'] = 'application/json';
      allHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method, headers: allHeaders }, (res) => {
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

async function withServer(fn) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function parseCookies(setCookieHeaders) {
  return (setCookieHeaders || []).map((header) => header.split(';')[0]).join('; ');
}

function csrfFrom(cookie) {
  const match = /csrf_token=([^;]+)/.exec(cookie || '');
  return match ? match[1] : '';
}

/** Walks src/ so a fallback cannot be reintroduced in some other module. */
function readAllSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAllSourceFiles(full));
    else if (entry.name.endsWith('.js')) out.push([full, fs.readFileSync(full, 'utf8')]);
  }
  return out;
}

test('SECURITY: no admin password is hardcoded anywhere in src/', () => {
  const offenders = [];
  for (const [file, contents] of readAllSourceFiles(SRC_DIR)) {
    if (contents.includes('changeme123')) offenders.push(`${file}: literal changeme123`);
    // hashPassword() called on a literal in shipped code means a baked-in password.
    if (/hashPassword\(\s*['"`]/.test(contents)) offenders.push(`${file}: hashPassword() on a string literal`);
  }
  assert.deepEqual(offenders, [], 'shipped code must contain no admin password');
});

test('the admin store is empty when the env vars are not configured', () => {
  // The suite runs without ADMIN_EMAIL / ADMIN_PASSWORD_HASH set, so the store
  // starts empty and only the test fixture ever fills it.
  assert.equal(adminStore.length, 0);
  assert.equal(isAdminConfigured(), false);
});

test('SECURITY: admin login fails closed when no account is configured', async () => {
  await withServer(async (port) => {
    const landing = await request(port, { path: '/admin' });
    const cookie = parseCookies(landing.headers['set-cookie']);

    for (const attempt of [
      { email: 'admin@example.com', password: 'changeme123' },
      { email: 'admin@test.invalid', password: 'test-only-not-a-real-password' },
      { email: '', password: '' },
    ]) {
      const res = await request(port, {
        path: '/api/admin/login',
        method: 'POST',
        headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
        body: attempt,
      });

      assert.notEqual(res.statusCode, 200, `"${attempt.email}" must not be able to sign in`);
      assert.equal(res.body.reason, 'admin_not_configured');
    }
  });
});

test('the old default credentials are refused even once an admin IS configured', async () => {
  seedTestAdmin();
  await withServer(async (port) => {
    const landing = await request(port, { path: '/admin' });
    const cookie = parseCookies(landing.headers['set-cookie']);

    const res = await request(port, {
      path: '/api/admin/login',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { email: 'admin@example.com', password: 'changeme123' },
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.reason, 'invalid_credentials');
  });
});

test('admin pages and APIs stay shut when no account is configured', async () => {
  await withServer(async (port) => {
    const page = await request(port, { path: '/admin/guests' });
    assert.equal(page.statusCode, 302, 'admin pages redirect to login');

    const api = await request(port, { path: '/api/admin/dashboard' });
    assert.equal(api.statusCode, 401, 'admin APIs stay 401');
  });
});

test('the login page tells the operator how to configure an admin', async () => {
  await withServer(async (port) => {
    const page = await request(port, { path: '/admin' });
    assert.match(page.text, /No admin account is configured/i);
    assert.match(page.text, /admin:hash/, 'and names the command that fixes it');
  });
});

test('the real ADMIN_EMAIL / ADMIN_PASSWORD_HASH path works end to end', async () => {
  // Every other admin test seeds adminStore directly, which skips the env-var
  // parsing a real deployment relies on. This runs it in a child process with
  // the vars set before import, as `node src/server.js` would see them.
  const probe = path.join(PROJECT_ROOT, 'helpers', 'envAdminProbe.mjs');
  const { stdout } = await execFile(process.execPath, [probe], { cwd: path.join(PROJECT_ROOT, '..') });
  const result = JSON.parse(stdout.trim().split('\n').pop());

  assert.equal(result.configured, true, 'env vars must produce a configured admin');
  assert.equal(result.realCredentials.status, 200, 'the configured admin can sign in');
  assert.equal(result.realCredentials.body.success, true);

  assert.equal(result.oldFallback.status, 401, 'the removed default must not work');
  assert.equal(result.oldFallback.body.reason, 'invalid_credentials');

  assert.equal(result.wrongPassword.status, 401, 'a wrong password is still refused');
});
