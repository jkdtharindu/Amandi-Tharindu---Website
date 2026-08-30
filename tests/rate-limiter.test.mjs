import { test } from 'node:test';
import assert from 'node:assert';
import { RateLimiter, createRateLimitMiddleware } from '../src/rate-limiter.js';

test('RateLimiter: tracks requests per IP and endpoint', () => {
  const limiter = new RateLimiter();

  // First 3 requests should be allowed
  const result1 = limiter.check('192.168.1.1', '/api/guest/login', 3, 60000);
  assert.strictEqual(result1.allowed, true);
  assert.strictEqual(result1.remaining, 2);

  const result2 = limiter.check('192.168.1.1', '/api/guest/login', 3, 60000);
  assert.strictEqual(result2.allowed, true);
  assert.strictEqual(result2.remaining, 1);

  const result3 = limiter.check('192.168.1.1', '/api/guest/login', 3, 60000);
  assert.strictEqual(result3.allowed, true);
  assert.strictEqual(result3.remaining, 0);

  // 4th request should be denied
  const result4 = limiter.check('192.168.1.1', '/api/guest/login', 3, 60000);
  assert.strictEqual(result4.allowed, false);
  assert.strictEqual(result4.remaining, 0);
});

test('RateLimiter: different IPs have separate limits', () => {
  const limiter = new RateLimiter();

  // IP 1: 2 requests allowed
  const result1 = limiter.check('192.168.1.1', '/api/guest/login', 2, 60000);
  assert.strictEqual(result1.allowed, true);

  const result2 = limiter.check('192.168.1.1', '/api/guest/login', 2, 60000);
  assert.strictEqual(result2.allowed, true);

  const result3 = limiter.check('192.168.1.1', '/api/guest/login', 2, 60000);
  assert.strictEqual(result3.allowed, false);

  // IP 2: should have independent limit
  const result4 = limiter.check('192.168.1.2', '/api/guest/login', 2, 60000);
  assert.strictEqual(result4.allowed, true);

  const result5 = limiter.check('192.168.1.2', '/api/guest/login', 2, 60000);
  assert.strictEqual(result5.allowed, true);
});

test('RateLimiter: different endpoints have separate limits', () => {
  const limiter = new RateLimiter();

  // /api/guest/login: max 2
  const result1 = limiter.check('192.168.1.1', '/api/guest/login', 2, 60000);
  assert.strictEqual(result1.allowed, true);

  const result2 = limiter.check('192.168.1.1', '/api/guest/login', 2, 60000);
  assert.strictEqual(result2.allowed, true);

  // /api/guest/rsvp: should have independent limit
  const result3 = limiter.check('192.168.1.1', '/api/guest/rsvp', 2, 60000);
  assert.strictEqual(result3.allowed, true);

  const result4 = limiter.check('192.168.1.1', '/api/guest/rsvp', 2, 60000);
  assert.strictEqual(result4.allowed, true);
});

test('RateLimiter: expired requests are removed', async () => {
  const limiter = new RateLimiter();
  const windowMs = 100; // 100ms window

  // Add request at t=0
  const result1 = limiter.check('192.168.1.1', '/api/guest/login', 1, windowMs);
  assert.strictEqual(result1.allowed, true);

  // Immediately, 2nd request should be denied
  const result2 = limiter.check('192.168.1.1', '/api/guest/login', 1, windowMs);
  assert.strictEqual(result2.allowed, false);

  // Wait for window to expire
  await new Promise(resolve => setTimeout(resolve, windowMs + 10));

  // After window expires, request should be allowed again
  const result3 = limiter.check('192.168.1.1', '/api/guest/login', 1, windowMs);
  assert.strictEqual(result3.allowed, true);
});

test('RateLimiter: returns correct retry info', () => {
  const limiter = new RateLimiter();

  limiter.check('192.168.1.1', '/api/guest/login', 1, 60000);
  const result = limiter.check('192.168.1.1', '/api/guest/login', 1, 60000);

  assert.strictEqual(result.allowed, false);
  assert(result.retryAfter > 0);
  assert(result.retryAfter <= 60); // Should be close to 60 seconds
  assert(result.resetTime > Date.now());
});

test('RateLimiter: reset clears all data', () => {
  const limiter = new RateLimiter();

  limiter.check('192.168.1.1', '/api/guest/login', 2, 60000);
  limiter.check('192.168.1.1', '/api/guest/login', 2, 60000);

  limiter.reset();

  // After reset, should allow request again
  const result = limiter.check('192.168.1.1', '/api/guest/login', 2, 60000);
  assert.strictEqual(result.allowed, true);
});

test('RateLimiter: getStats returns correct counts', () => {
  const limiter = new RateLimiter();

  limiter.check('192.168.1.1', '/api/guest/login', 5, 60000);
  limiter.check('192.168.1.1', '/api/guest/login', 5, 60000);
  limiter.check('192.168.1.1', '/api/guest/rsvp', 5, 60000);
  limiter.check('192.168.1.2', '/api/guest/login', 5, 60000);

  const stats = limiter.getStats();

  // 3 unique keys: "192.168.1.1:/api/guest/login", "192.168.1.1:/api/guest/rsvp", "192.168.1.2:/api/guest/login"
  assert.strictEqual(stats.trackedKeys, 3);

  // 4 total requests
  assert.strictEqual(stats.totalRequests, 4);
});
