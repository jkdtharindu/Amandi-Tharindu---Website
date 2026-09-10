import test from 'node:test';
import assert from 'node:assert/strict';

import { GATE_ROUTE, isGatedPath } from '../src/site-gate.js';
import { normalizeInvitationCode } from '../src/guest-auth/normalizeInvitationCode.js';
import { authorizeRsvp } from '../src/guest-auth/authorizeRsvp.js';
import { guestSessionMaxAgeSeconds } from '../src/session.js';

test('gates every guest-facing page, including invitation links and the old login page', () => {
  for (const path of [
    '/',
    '/our-story',
    '/the-celebration',
    '/gallery',
    '/wishes',
    '/invitation',
    '/invitation/SILVA-001',
    '/login',
  ]) {
    assert.equal(isGatedPath(path), true, path);
  }
});

test('does not gate the admin panel, API routes, framework assets, fonts or the gate itself', () => {
  for (const path of [
    '/admin',
    '/admin/guests',
    '/api/csrf',
    '/api/guest/login',
    '/_next/static/chunks/app.js',
    '/fonts/cinzel-latin-400-normal.woff2',
    GATE_ROUTE,
    '/favicon.ico',
    '/robots.txt',
  ]) {
    assert.equal(isGatedPath(path), false, path);
  }
});

test('matches exempt prefixes by whole path segment only', () => {
  assert.equal(isGatedPath('/administrator'), true);
  assert.equal(isGatedPath('/apis'), true);
  assert.equal(isGatedPath('/gateway'), true);
});

test('treats a missing pathname as the home page', () => {
  assert.equal(isGatedPath(undefined), true);
  assert.equal(isGatedPath(''), true);
});

test('normalizes a typed invitation code to trimmed upper case', () => {
  assert.equal(normalizeInvitationCode('  silva-001 '), 'SILVA-001');
  assert.equal(normalizeInvitationCode('NEI-RU-742'), 'NEI-RU-742');
  assert.equal(normalizeInvitationCode(undefined), '');
  assert.equal(normalizeInvitationCode(null), '');
});

test('refuses an RSVP from a signed-out visitor', () => {
  const result = authorizeRsvp(null, 'SILVA-001');
  assert.equal(result.allowed, false);
  assert.equal(result.status, 401);
});

test("refuses an RSVP for another guest's code", () => {
  const result = authorizeRsvp({ id: 'guest-1', code: 'SILVA-001' }, 'SILVA-002');
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
});

test("allows an RSVP for the signed-in guest's own code, in any case", () => {
  const guest = { id: 'guest-1', code: 'SILVA-001' };
  assert.deepEqual(authorizeRsvp(guest, 'silva-001'), { allowed: true, guest });
});

test('allows an RSVP with no code, using the session guest', () => {
  const guest = { id: 'guest-1', code: 'SILVA-001' };
  assert.deepEqual(authorizeRsvp(guest, undefined), { allowed: true, guest });
});

test('guest sign-in lasts GUEST_SESSION_TTL_DAYS, defaulting to 30 days', () => {
  const day = 24 * 60 * 60;
  assert.equal(guestSessionMaxAgeSeconds(undefined), 30 * day);
  assert.equal(guestSessionMaxAgeSeconds('7'), 7 * day);
  assert.equal(guestSessionMaxAgeSeconds('not-a-number'), 30 * day);
  assert.equal(guestSessionMaxAgeSeconds('0'), 30 * day);
  assert.equal(guestSessionMaxAgeSeconds('-5'), 30 * day);
});
