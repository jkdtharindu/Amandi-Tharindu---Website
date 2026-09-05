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

test('RateLimiter: cleanup keeps a caller blocked while their window is still open', () => {
  let clock = 1_000_000;
  const limiter = new RateLimiter({ now: () => clock });
  const windowMs = 15 * 60 * 1000; // the admin login window

  limiter.check('1.1.1.1', '/e', 1, windowMs);
  assert.strictEqual(limiter.check('1.1.1.1', '/e', 1, windowMs).allowed, false);

  // Cleanup runs on its own schedule, unrelated to this caller's window.
  clock += 7 * 60 * 1000;
  limiter.prune();

  // Seven minutes into a fifteen-minute block, so the block must survive.
  assert.strictEqual(limiter.check('1.1.1.1', '/e', 1, windowMs).allowed, false);
});

test('RateLimiter: cleanup releases a caller once their window has passed', () => {
  let clock = 1_000_000;
  const limiter = new RateLimiter({ now: () => clock });
  const windowMs = 15 * 60 * 1000;

  limiter.check('1.1.1.1', '/e', 1, windowMs);

  clock += windowMs + 1;
  limiter.prune();

  assert.strictEqual(limiter.requests.size, 0, 'expired entries must not leak');
  assert.strictEqual(limiter.check('1.1.1.1', '/e', 1, windowMs).allowed, true);
});

test('RateLimiter: cleanup respects each caller own window', () => {
  let clock = 1_000_000;
  const limiter = new RateLimiter({ now: () => clock });
  const shortWindow = 60 * 1000;
  const longWindow = 15 * 60 * 1000;

  limiter.check('short', '/e', 1, shortWindow);
  limiter.check('long', '/e', 1, longWindow);

  clock += 5 * 60 * 1000;
  limiter.prune();

  assert.strictEqual(limiter.check('short', '/e', 1, shortWindow).allowed, true);
  assert.strictEqual(limiter.check('long', '/e', 1, longWindow).allowed, false);
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
