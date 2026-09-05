import { test } from 'node:test';
import assert from 'node:assert';
import { resolveClientIp } from '../src/security/clientIp.js';

test('resolveClientIp: ignores forwarded headers when no proxy is trusted', () => {
  const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' });
  assert.strictEqual(resolveClientIp(headers, { trustedProxyCount: 0 }), null);
});

test('resolveClientIp: with one trusted proxy, takes the address the proxy appended', () => {
  // A trusted proxy appends the peer it saw. Anything to the left was sent by
  // the client and cannot be trusted.
  const headers = new Headers({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' });
  assert.strictEqual(resolveClientIp(headers, { trustedProxyCount: 1 }), '203.0.113.7');
});

test('resolveClientIp: a spoofed leftmost value cannot change the resolved address', () => {
  const attacker = new Headers({ 'x-forwarded-for': 'evil-1, 203.0.113.7' });
  const attackerRetry = new Headers({ 'x-forwarded-for': 'evil-2, 203.0.113.7' });

  // Both requests must land in the same rate-limit bucket, otherwise rotating
  // the header is a free bypass.
  assert.strictEqual(
    resolveClientIp(attacker, { trustedProxyCount: 1 }),
    resolveClientIp(attackerRetry, { trustedProxyCount: 1 })
  );
});

test('resolveClientIp: with two trusted proxies, skips both hops', () => {
  const headers = new Headers({
    'x-forwarded-for': 'spoofed, 203.0.113.7, 10.0.0.1',
  });
  assert.strictEqual(resolveClientIp(headers, { trustedProxyCount: 2 }), '203.0.113.7');
});

test('resolveClientIp: returns null when the chain is shorter than the trusted hop count', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
  assert.strictEqual(resolveClientIp(headers, { trustedProxyCount: 3 }), null);
});

test('resolveClientIp: returns null when the header is absent', () => {
  assert.strictEqual(resolveClientIp(new Headers(), { trustedProxyCount: 1 }), null);
});

test('resolveClientIp: ignores blank entries in the chain', () => {
  const headers = new Headers({ 'x-forwarded-for': 'spoofed, , 203.0.113.7' });
  assert.strictEqual(resolveClientIp(headers, { trustedProxyCount: 1 }), '203.0.113.7');
});
