import { test } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { startTestServer } from './helpers/test-server.mjs';
import { securityHeadersMiddleware, securityHeadersPresets, getSecurityHeadersPreset } from '../src/security-headers.js';

async function withTestApp(configureApp, run) {
  const app = express();
  configureApp(app);
  const server = await startTestServer(app);
  try {
    await run(server.baseUrl);
  } finally {
    await server.close();
  }
}

function createTestApp(options = {}) {
  return (app) => {
    app.use(securityHeadersMiddleware(options));
    app.get('/', (req, res) => res.send('OK'));
  };
}

test('Security Headers: sets MIME type protection', async () => {
  await withTestApp(createTestApp(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  });
});

test('Security Headers: sets clickjacking protection', async () => {
  await withTestApp(createTestApp(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
  });
});

test('Security Headers: enables XSS filter', async () => {
  await withTestApp(createTestApp(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('x-xss-protection'), '1; mode=block');
  });
});

test('Security Headers: sets referrer policy', async () => {
  await withTestApp(createTestApp(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('referrer-policy'), 'no-referrer');
  });
});

test('Security Headers: sets permissions policy', async () => {
  await withTestApp(createTestApp(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    const permissionsPolicy = res.headers.get('permissions-policy');
    assert(permissionsPolicy.includes('geolocation=()'));
    assert(permissionsPolicy.includes('microphone=()'));
    assert(permissionsPolicy.includes('camera=()'));
  });
});

test('Security Headers: sets content security policy', async () => {
  await withTestApp(createTestApp(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    const csp = res.headers.get('content-security-policy');
    assert(csp.includes("default-src 'self'"));
    assert(csp.includes("script-src 'self' 'unsafe-inline'"));
    assert(csp.includes("style-src 'self' 'unsafe-inline'"));
    assert(csp.includes("frame-ancestors 'none'"));
  });
});

test('Security Headers: removes X-Powered-By header', async () => {
  await withTestApp((app) => {
    app.use((req, res, next) => {
      res.setHeader('X-Powered-By', 'Express');
      next();
    });
    app.use(securityHeadersMiddleware({ hidePoweredBy: true }));
    app.get('/', (req, res) => res.send('OK'));
  }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert(!res.headers.get('x-powered-by'));
  });
});

test('Security Headers: respects custom frameguard action', async () => {
  await withTestApp(createTestApp({ frameguard: { action: 'sameorigin' } }), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  });
});

test('Security Headers: respects custom referrer policy', async () => {
  await withTestApp(createTestApp({ referrerPolicy: { policy: 'strict-no-referrer' } }), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('referrer-policy'), 'strict-no-referrer');
  });
});

test('Security Headers: can disable CSP', async () => {
  await withTestApp(createTestApp({ contentSecurityPolicy: false }), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert(!res.headers.get('content-security-policy'));
  });
});

test('Security Headers: sets DNS prefetch control', async () => {
  await withTestApp(createTestApp({ dnsPrefetchControl: { allow: false } }), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('x-dns-prefetch-control'), 'off');
  });
});

test('Security Headers: sets IE download options', async () => {
  await withTestApp(createTestApp(), async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.headers.get('x-download-options'), 'noopen');
  });
});

test('Security Headers: preset - development', () => {
  const preset = securityHeadersPresets.development;
  assert.strictEqual(preset.contentSecurityPolicy, false);
  assert.strictEqual(preset.hsts, false);
  assert(preset.frameguard);
});

test('Security Headers: preset - relaxed', () => {
  const preset = securityHeadersPresets.relaxed;
  assert.strictEqual(preset.contentSecurityPolicy, true);
  assert(preset.hsts);
  assert.strictEqual(preset.hsts.maxAge, 31536000);
});

test('Security Headers: preset - strict', () => {
  const preset = securityHeadersPresets.strict;
  assert.strictEqual(preset.contentSecurityPolicy, true);
  assert.strictEqual(preset.noSniff, true);
  assert.strictEqual(preset.xssFilter, true);
});

test('Security Headers: getSecurityHeadersPreset returns a preset', () => {
  const preset = getSecurityHeadersPreset();
  assert(preset);
});
