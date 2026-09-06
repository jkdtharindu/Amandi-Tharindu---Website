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
 * Create a Next.js route handler middleware that enforces rate limiting.
 * Usage in a route.ts POST handler:
 *
 *   const limiter = createGuestLoginLimiter();
 *   export async function POST(request: NextRequest) {
 *     const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
 *     const result = limiter.check(clientIp);
 *     if (!result.allowed) {
 *       return NextResponse.json(
 *         { success: false, reason: 'too_many_attempts', message: 'Too many login attempts. Try again in 10 minutes.' },
 *         { status: 429, headers: { 'Retry-After': String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)) } }
 *       );
 *     }
 *     // ... rest of handler
 *   }
 */
export function createGuestLoginLimiter(maxAttempts = 10, windowMs = 10 * 60 * 1000) {
  return new RateLimiter(maxAttempts, windowMs);
}

export function createAdminLoginLimiter(maxAttempts = 8, windowMs = 15 * 60 * 1000) {
  return new RateLimiter(maxAttempts, windowMs);
}
