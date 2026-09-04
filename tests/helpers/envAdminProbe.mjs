/**
 * Probe run as a child process by tests/admin-no-fallback.test.mjs.
 *
 * The admin tests seed `adminStore` directly, which bypasses the ADMIN_EMAIL /
 * ADMIN_PASSWORD_HASH parsing that a real deployment depends on. This exercises
 * that path for real: env vars set before the module is imported, exactly as
 * `node src/server.js` would see them.
 *
 * Prints a single JSON line for the parent to assert on.
 */
import http from 'http';
import { hashPassword } from '../../src/admin-auth/hashPassword.js';

const EMAIL = 'real.admin@example.org';
const PASSWORD = 'a-properly-long-password';

process.env.ADMIN_EMAIL = EMAIL;
process.env.ADMIN_PASSWORD_HASH = hashPassword(PASSWORD);

const { createApp } = await import('../../src/server.js');
const { isAdminConfigured } = await import('../../src/data/adminStore.js');

const server = http.createServer(createApp());
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

const landing = await fetch(`http://127.0.0.1:${port}/admin`);
const cookie = (landing.headers.getSetCookie() || []).map((header) => header.split(';')[0]).join('; ');
const csrf = /csrf_token=([^;]+)/.exec(cookie)[1];

async function login(email, password) {
  const res = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, Cookie: cookie },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json() };
}

const result = {
  configured: isAdminConfigured(),
  realCredentials: await login(EMAIL, PASSWORD),
  oldFallback: await login('admin@example.com', 'changeme123'),
  wrongPassword: await login(EMAIL, 'nope'),
};

console.log(JSON.stringify(result));
server.close();
