import { test } from 'node:test';
import assert from 'node:assert';
import { RateLimiter, rateLimitHeaders } from '../src/security/rateLimiter.js';

test('RateLimiter: allows up to the limit, then denies', () => {
  const limiter = new RateLimiter();

  assert.strictEqual(limiter.check('1.1.1.1', '/api/guest/login', 3, 60000).allowed, true);
  assert.strictEqual(limiter.check('1.1.1.1', '/api/guest/login', 3, 60000).allowed, true);
  assert.strictEqual(limiter.check('1.1.1.1', '/api/guest/login', 3, 60000).allowed, true);

  const denied = limiter.check('1.1.1.1', '/api/guest/login', 3, 60000);
  assert.strictEqual(denied.allowed, false);
  assert.strictEqual(denied.remaining, 0);
  assert.ok(denied.retryAfter > 0);
});

test('RateLimiter: reports remaining budget', () => {
  const limiter = new RateLimiter();

  assert.strictEqual(limiter.check('1.1.1.1', '/e', 3, 60000).remaining, 2);
  assert.strictEqual(limiter.check('1.1.1.1', '/e', 3, 60000).remaining, 1);
  assert.strictEqual(limiter.check('1.1.1.1', '/e', 3, 60000).remaining, 0);
});

test('RateLimiter: different callers have independent budgets', () => {
  const limiter = new RateLimiter();

  limiter.check('1.1.1.1', '/e', 1, 60000);
  assert.strictEqual(limiter.check('1.1.1.1', '/e', 1, 60000).allowed, false);
  assert.strictEqual(limiter.check('2.2.2.2', '/e', 1, 60000).allowed, true);
});

test('RateLimiter: different endpoints have independent budgets', () => {
  const limiter = new RateLimiter();

  limiter.check('1.1.1.1', '/login', 1, 60000);
  assert.strictEqual(limiter.check('1.1.1.1', '/login', 1, 60000).allowed, false);
  assert.strictEqual(limiter.check('1.1.1.1', '/rsvp', 1, 60000).allowed, true);
});

test('RateLimiter: a denied request does not extend the block', () => {
  const limiter = new RateLimiter();
  const windowMs = 60000;

  limiter.check('1.1.1.1', '/e', 1, windowMs);
  const first = limiter.check('1.1.1.1', '/e', 1, windowMs);
  const second = limiter.check('1.1.1.1', '/e', 1, windowMs);

  // Rejected attempts must not be recorded, otherwise hammering the endpoint
  // keeps pushing the reset time out and locks the caller out indefinitely.
  assert.strictEqual(first.allowed, false);
  assert.strictEqual(second.allowed, false);
  assert.strictEqual(first.resetTime, second.resetTime);
});

test('RateLimiter: budget frees up once the window passes', () => {
  const limiter = new RateLimiter();

  assert.strictEqual(limiter.check('1.1.1.1', '/e', 1, 1).allowed, true);
  const start = Date.now();
  while (Date.now() - start < 5) {
    // Wait out the 1ms window without pulling in a timer helper.
  }
  assert.strictEqual(limiter.check('1.1.1.1', '/e', 1, 1).allowed, true);
});

test('RateLimiter: reset() clears all tracked callers', () => {
  const limiter = new RateLimiter();

  limiter.check('1.1.1.1', '/e', 1, 60000);
  limiter.reset();
  assert.strictEqual(limiter.check('1.1.1.1', '/e', 1, 60000).allowed, true);
});

test('RateLimiter: clear() frees one caller without touching the others', () => {
  const limiter = new RateLimiter();

  limiter.check('1.1.1.1', '/e', 1, 60000);
  limiter.check('2.2.2.2', '/e', 1, 60000);

  limiter.clear('1.1.1.1', '/e');

  assert.strictEqual(limiter.check('1.1.1.1', '/e', 1, 60000).allowed, true);
  assert.strictEqual(limiter.check('2.2.2.2', '/e', 1, 60000).allowed, false);
});

test('rateLimitHeaders: exposes limit, remaining and reset', () => {
  const limiter = new RateLimiter();
  const result = limiter.check('1.1.1.1', '/e', 5, 60000);
  const headers = rateLimitHeaders(result, 5);

  assert.strictEqual(headers['X-RateLimit-Limit'], '5');
  assert.strictEqual(headers['X-RateLimit-Remaining'], '4');
  assert.ok(Number(headers['X-RateLimit-Reset']) > 0);
  assert.strictEqual('Retry-After' in headers, false);
});

test('rateLimitHeaders: adds Retry-After once the caller is blocked', () => {
  const limiter = new RateLimiter();
  limiter.check('1.1.1.1', '/e', 1, 60000);
  const denied = limiter.check('1.1.1.1', '/e', 1, 60000);
  const headers = rateLimitHeaders(denied, 1);

  assert.ok(Number(headers['Retry-After']) > 0);
});
