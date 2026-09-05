import { test } from 'node:test';
import assert from 'node:assert';

const ENDPOINT = '/api/test/login';
const TIGHT_LIMIT = { maxRequests: 2, windowMs: 60000 };

async function withEnv(env, run) {
  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    // Fresh module instance per case: the limiter holds state at module scope.
    const fresh = await import(`../src/security/authRateLimit.js?case=${Math.random()}`);
    await run(fresh);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('checkAuthRateLimit: blocks a caller past the limit', async () => {
  await withEnv({ TRUSTED_PROXY_COUNT: '1' }, ({ checkAuthRateLimit }) => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });

    assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, true);
    assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, true);

    const blocked = checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
    assert.strictEqual(blocked.allowed, false);
    assert.ok(Number(blocked.headers['Retry-After']) > 0);
  });
});

test('checkAuthRateLimit: rotating X-Forwarded-For does not buy a fresh budget', async () => {
  await withEnv({ TRUSTED_PROXY_COUNT: '1' }, ({ checkAuthRateLimit }) => {
    const attempt = (spoofed) =>
      checkAuthRateLimit(
        new Headers({ 'x-forwarded-for': `${spoofed}, 203.0.113.7` }),
        ENDPOINT,
        TIGHT_LIMIT
      );

    assert.strictEqual(attempt('1.1.1.1').allowed, true);
    assert.strictEqual(attempt('2.2.2.2').allowed, true);
    assert.strictEqual(attempt('3.3.3.3').allowed, false);
  });
});

test('checkAuthRateLimit: unidentified callers are still limited in production', async () => {
  await withEnv({ NODE_ENV: 'production', TRUSTED_PROXY_COUNT: '0' }, ({ checkAuthRateLimit }) => {
    const headers = new Headers();

    assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, true);
    assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, true);
    assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, false);
  });
});

test('checkAuthRateLimit: unidentified callers are not limited outside production', async () => {
  await withEnv({ NODE_ENV: 'test', TRUSTED_PROXY_COUNT: '0' }, ({ checkAuthRateLimit }) => {
    const headers = new Headers();

    for (let i = 0; i < 5; i += 1) {
      assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, true);
    }
  });
});

test('checkAuthRateLimit: logs the moment a caller is blocked, once per block', async () => {
  await withEnv({ TRUSTED_PROXY_COUNT: '1' }, ({ checkAuthRateLimit }) => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
    const warned = [];
    const originalWarn = console.warn;
    console.warn = (line) => warned.push(line);

    try {
      checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
      checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
      assert.strictEqual(warned.length, 0, 'allowed attempts are not security events');

      checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
      checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
      checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
    } finally {
      console.warn = originalWarn;
    }

    assert.strictEqual(warned.length, 1, 'hammering while blocked must not flood the logs');

    const entry = JSON.parse(warned[0]);
    assert.strictEqual(entry.event, 'rate_limited');
    assert.strictEqual(entry.details.endpoint, ENDPOINT);
    assert.strictEqual(entry.details.ip, '203.0.*.*', 'the caller is masked');
  });
});

test('clearAuthRateLimit: a successful login does not refund the shared bucket', async () => {
  await withEnv(
    { NODE_ENV: 'production', TRUSTED_PROXY_COUNT: '0' },
    ({ checkAuthRateLimit, clearAuthRateLimit }) => {
      const headers = new Headers();

      const first = checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
      checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
      assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, false);

      // Everyone unidentified shares this bucket, so refunding it on one
      // success would hand every other caller in it a fresh budget too.
      clearAuthRateLimit(first.identifier, ENDPOINT);

      assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, false);
    }
  );
});

test('clearAuthRateLimit: a successful login frees that caller', async () => {
  await withEnv({ TRUSTED_PROXY_COUNT: '1' }, ({ checkAuthRateLimit, clearAuthRateLimit }) => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });

    const first = checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
    checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT);
    assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, false);

    clearAuthRateLimit(first.identifier, ENDPOINT);

    assert.strictEqual(checkAuthRateLimit(headers, ENDPOINT, TIGHT_LIMIT).allowed, true);
  });
});
