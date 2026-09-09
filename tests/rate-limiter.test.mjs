import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, createGuestLoginLimiter, createAdminLoginLimiter } from '../src/rate-limiter.js';

test('RateLimiter allows requests within the limit', () => {
  const limiter = new RateLimiter(3, 60000);

  const r1 = limiter.check('192.168.1.1');
  assert.equal(r1.allowed, true, 'First request allowed');
  assert.equal(r1.remaining, 2, 'Two requests remaining after first');

  const r2 = limiter.check('192.168.1.1');
  assert.equal(r2.allowed, true, 'Second request allowed');
  assert.equal(r2.remaining, 1, 'One request remaining after second');

  const r3 = limiter.check('192.168.1.1');
  assert.equal(r3.allowed, true, 'Third request allowed');
  assert.equal(r3.remaining, 0, 'No requests remaining after third');
});

test('RateLimiter blocks requests beyond the limit', () => {
  const limiter = new RateLimiter(2, 60000);

  limiter.check('192.168.1.2');
  limiter.check('192.168.1.2');

  const r3 = limiter.check('192.168.1.2');
  assert.equal(r3.allowed, false, 'Third request blocked');
  assert.equal(r3.remaining, 0, 'Remaining is 0');
  assert(r3.resetAt instanceof Date, 'resetAt is a Date');
});

test('RateLimiter tracks separate clients independently', () => {
  const limiter = new RateLimiter(2, 60000);

  const r1_ip1 = limiter.check('192.168.1.1');
  const r1_ip2 = limiter.check('192.168.1.2');
  assert.equal(r1_ip1.allowed, true, 'First client first request allowed');
  assert.equal(r1_ip2.allowed, true, 'Second client first request allowed');

  const r2_ip1 = limiter.check('192.168.1.1');
  const r2_ip2 = limiter.check('192.168.1.2');
  assert.equal(r2_ip1.allowed, true, 'First client second request allowed');
  assert.equal(r2_ip2.allowed, true, 'Second client second request allowed');

  const r3_ip1 = limiter.check('192.168.1.1');
  const r3_ip2 = limiter.check('192.168.1.2');
  assert.equal(r3_ip1.allowed, false, 'First client third request blocked');
  assert.equal(r3_ip2.allowed, false, 'Second client third request blocked');
});

test('RateLimiter resets window after expiration', (t, done) => {
  const limiter = new RateLimiter(1, 100); // 100ms window
  const key = '192.168.1.3';

  const r1 = limiter.check(key);
  assert.equal(r1.allowed, true, 'First request allowed');

  const r2 = limiter.check(key);
  assert.equal(r2.allowed, false, 'Second request blocked before window expires');

  setTimeout(() => {
    const r3 = limiter.check(key);
    assert.equal(r3.allowed, true, 'Request allowed after window expires');
    done();
  }, 150);
});

test('RateLimiter.reset() clears a client', () => {
  const limiter = new RateLimiter(2, 60000);
  const key = '192.168.1.4';

  limiter.check(key);
  limiter.check(key);
  assert.equal(limiter.check(key).allowed, false, 'Request blocked before reset');

  limiter.reset(key);
  assert.equal(limiter.check(key).allowed, true, 'Request allowed after reset');
});

test('createGuestLoginLimiter has correct defaults', () => {
  const limiter = createGuestLoginLimiter();

  // Should allow 10 attempts in 10 minutes
  for (let i = 0; i < 10; i++) {
    const r = limiter.check('test-ip');
    assert.equal(r.allowed, true, `Attempt ${i + 1} allowed`);
  }

  const r11 = limiter.check('test-ip');
  assert.equal(r11.allowed, false, 'Eleventh attempt blocked');
});

test('createAdminLoginLimiter has correct defaults', () => {
  const limiter = createAdminLoginLimiter();

  // Should allow 8 attempts in 15 minutes
  for (let i = 0; i < 8; i++) {
    const r = limiter.check('test-ip');
    assert.equal(r.allowed, true, `Attempt ${i + 1} allowed`);
  }

  const r9 = limiter.check('test-ip');
  assert.equal(r9.allowed, false, 'Ninth attempt blocked');
});
