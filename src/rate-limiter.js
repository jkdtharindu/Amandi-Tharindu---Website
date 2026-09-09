/**
 * In-memory rate limiter for Next.js API routes and Express endpoints.
 * Tracks requests by key (e.g., IP address) within a time window.
 *
 * WARNING: This is single-process only. For distributed deployments, use Redis.
 * Each instance maintains its own counter, so the limit applies per-instance.
 */

export class RateLimiter {
  constructor(maxRequests = 5, windowMs = 10 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.attempts = new Map();
    // Clean up expired entries every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref?.();
  }

  /**
   * Check if a request from `key` (e.g., IP) is within the rate limit.
   * Returns { allowed: boolean, remaining: number, resetAt: Date }
   */
  check(key) {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || entry.resetAt < now) {
      // First request in this window or window expired
      const resetAt = now + this.windowMs;
      this.attempts.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: new Date(resetAt) };
    }

    entry.count += 1;
    const allowed = entry.count <= this.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetAt: new Date(entry.resetAt),
    };
  }

  reset(key) {
    this.attempts.delete(key);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (entry.resetAt < now) {
        this.attempts.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.attempts.clear();
  }
}

/**
 * The counter key for a request, accepting both an Express `req` and a Next.js
 * `NextRequest` (same dual-shape handling as `verifyCsrfToken` in src/csrf.js).
 *
 * Behind a proxy every request carries the proxy's own IP, so the client is the
 * first entry of `x-forwarded-for`. That header is client-settable when nothing
 * trustworthy sets it, which is why this is a speed bump for guessing codes and
 * not an access control.
 */
export function clientKey(req) {
  const forwarded =
    typeof req?.headers?.get === 'function'
      ? req.headers.get('x-forwarded-for')
      : req?.headers?.['x-forwarded-for'];

  return forwarded?.split(',')[0].trim() || req?.ip || 'local';
}

export function createGuestLoginLimiter(maxAttempts = 10, windowMs = 10 * 60 * 1000) {
  return new RateLimiter(maxAttempts, windowMs);
}

export function createAdminLoginLimiter(maxAttempts = 8, windowMs = 15 * 60 * 1000) {
  return new RateLimiter(maxAttempts, windowMs);
}
