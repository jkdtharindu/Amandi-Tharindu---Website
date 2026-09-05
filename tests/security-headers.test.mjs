import { test } from 'node:test';
import assert from 'node:assert';
import { buildSecurityHeaders } from '../src/security/securityHeaders.js';

function asMap(headers) {
  return new Map(headers.map(({ key, value }) => [key, value]));
}

test('buildSecurityHeaders: sets the core hardening headers', () => {
  const headers = asMap(buildSecurityHeaders({ isProduction: true }));

  assert.strictEqual(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.strictEqual(headers.get('X-Frame-Options'), 'DENY');
  assert.strictEqual(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.strictEqual(headers.get('X-DNS-Prefetch-Control'), 'off');
  assert.ok(headers.get('Permissions-Policy').includes('camera=()'));
});

test('buildSecurityHeaders: sends HSTS only in production', () => {
  const production = asMap(buildSecurityHeaders({ isProduction: true }));
  const development = asMap(buildSecurityHeaders({ isProduction: false }));

  assert.match(production.get('Strict-Transport-Security'), /^max-age=\d+; includeSubDomains$/);
  // Sending HSTS from a local http:// dev server would pin the browser to https
  // for localhost and break every other local project on the same port.
  assert.strictEqual(development.has('Strict-Transport-Security'), false);
});

test('buildSecurityHeaders: CSP blocks framing, plugins and stray form posts', () => {
  const csp = asMap(buildSecurityHeaders({ isProduction: true })).get('Content-Security-Policy');

  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("base-uri 'self'"));
  assert.ok(csp.includes("form-action 'self'"));
});

test('buildSecurityHeaders: production CSP does not allow unsafe-eval', () => {
  const csp = asMap(buildSecurityHeaders({ isProduction: true })).get('Content-Security-Policy');
  assert.ok(!csp.includes("'unsafe-eval'"));
});

test('buildSecurityHeaders: development CSP allows unsafe-eval for Turbopack HMR', () => {
  const csp = asMap(buildSecurityHeaders({ isProduction: false })).get('Content-Security-Policy');
  assert.ok(csp.includes("'unsafe-eval'"));
});

test('buildSecurityHeaders: every entry is a next.config-shaped {key, value} pair', () => {
  for (const entry of buildSecurityHeaders({ isProduction: true })) {
    assert.strictEqual(typeof entry.key, 'string');
    assert.strictEqual(typeof entry.value, 'string');
    assert.ok(entry.key.length > 0);
    assert.ok(entry.value.length > 0);
  }
});
