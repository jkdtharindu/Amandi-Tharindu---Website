const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * In-memory rate limiter, ported from the archived security branch
 * (`archive/claude/mobile-only-session-qj1ixz-2026-09-04`) and stripped of its
 * Express coupling so route handlers can call it directly.
 *
 * State lives in this process only: it resets on redeploy and is not shared
 * between instances. That is enough for a single-instance deployment; running
 * more than one instance needs a shared store (TASKS.md Next Action 8).
 */
export class RateLimiter {
  // `now` is injectable so the window/cleanup interaction can be tested without
  // waiting out real minutes.
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.requests = new Map();

    const timer = setInterval(() => this.prune(), CLEANUP_INTERVAL_MS);
    // Without unref() this timer keeps `node --test` and a shutting-down server alive.
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    this._cleanupTimer = timer;
  }

  check(identifier, endpoint, maxRequests, windowMs) {
    const key = `${identifier}:${endpoint}`;
    const now = this.now();
    const windowStart = now - windowMs;

    const previous = this.requests.get(key);
    const timestamps = (previous?.timestamps ?? []).filter((t) => t > windowStart);

    const allowed = timestamps.length < maxRequests;
    if (allowed) {
      timestamps.push(now);
    }
    // The window is stored alongside the hits so prune() can tell a caller who
    // is still inside their block from one whose window has actually expired.
    this.requests.set(key, { timestamps, windowMs });

    // Anchored to the oldest surviving hit, so repeated blocked attempts don't
    // keep pushing the reset time further out.
    const resetTime = timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;

    return {
      allowed,
      remaining: Math.max(0, maxRequests - timestamps.length),
      resetTime,
      retryAfter: allowed ? null : Math.max(1, Math.ceil((resetTime - now) / 1000)),
    };
  }

  clear(identifier, endpoint) {
    this.requests.delete(`${identifier}:${endpoint}`);
  }

  prune() {
    const now = this.now();
    for (const [key, entry] of this.requests.entries()) {
      const valid = entry.timestamps.filter((t) => t > now - entry.windowMs);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, { timestamps: valid, windowMs: entry.windowMs });
      }
    }
  }

  reset() {
    this.requests.clear();
  }

  stop() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }
}

export function rateLimitHeaders(result, maxRequests) {
  const headers = {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  };

  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}
