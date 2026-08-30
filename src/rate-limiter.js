/**
 * Rate Limiting Middleware
 *
 * Prevents brute force attacks and spam by limiting requests per IP + endpoint.
 * Uses in-memory storage (suitable for single-server deployments).
 *
 * For distributed deployments (multiple servers), use Redis instead.
 */

const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;

/**
 * Simple in-memory rate limiter
 * Tracks requests by IP address
 */
export class RateLimiter {
  constructor() {
    this.requests = new Map(); // { "ip:endpoint": [timestamps] }
    this.cleanup();
  }

  /**
   * Track a request and check if limit exceeded
   * @param {string} ip - Client IP address
   * @param {string} endpoint - Route/endpoint (e.g., "/api/guest/login")
   * @param {number} maxRequests - Max requests allowed in window
   * @param {number} windowMs - Time window in milliseconds
   * @returns {object} { allowed: boolean, remaining: number, resetTime: number }
   */
  check(ip, endpoint, maxRequests = DEFAULT_MAX_REQUESTS, windowMs = DEFAULT_WINDOW_MS) {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or initialize request history
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key);

    // Remove old requests outside window
    const validRequests = timestamps.filter(t => t > windowStart);
    this.requests.set(key, validRequests);

    // Check if limit exceeded
    const count = validRequests.length;
    const allowed = count < maxRequests;

    if (allowed) {
      // Add current request
      validRequests.push(now);
    }

    // Calculate reset time (when oldest request expires)
    const resetTime = validRequests.length > 0
      ? validRequests[0] + windowMs
      : now + windowMs;

    return {
      allowed,
      remaining: Math.max(0, maxRequests - count - 1),
      resetTime,
      retryAfter: allowed ? null : Math.ceil((resetTime - now) / 1000),
    };
  }

  /**
   * Cleanup old entries periodically (every 5 minutes)
   * Prevents memory leak
   */
  cleanup() {
    const timer = setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      for (const [key, timestamps] of this.requests.entries()) {
        const valid = timestamps.filter(t => t > fiveMinutesAgo);
        if (valid.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, valid);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Don't let this timer keep the process alive (server shutdown, test runners)
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    this._cleanupTimer = timer;
  }

  /**
   * Stop the background cleanup timer (for tests/graceful shutdown)
   */
  stop() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  /**
   * Reset all rate limit data (for testing)
   */
  reset() {
    this.requests.clear();
  }

  /**
   * Get current stats (for monitoring)
   */
  getStats() {
    return {
      trackedKeys: this.requests.size,
      totalRequests: Array.from(this.requests.values()).reduce((sum, arr) => sum + arr.length, 0),
    };
  }
}

/**
 * Express middleware for rate limiting
 * Attach specific rules per endpoint
 */
export function createRateLimitMiddleware(limiter, config = {}) {
  const defaultConfig = {
    maxRequests: DEFAULT_MAX_REQUESTS,
    windowMs: DEFAULT_WINDOW_MS,
    message: 'Too many requests, please try again later.',
    statusCode: 429,
  };

  const mergedConfig = { ...defaultConfig, ...config };

  return (req, res, next) => {
    // Skip rate limiting in development if DEBUG_SKIP_RATE_LIMIT is set
    if (process.env.DEBUG_SKIP_RATE_LIMIT === 'true' && process.env.NODE_ENV === 'development') {
      return next();
    }

    const ip = getClientIp(req);
    const endpoint = req.path;

    const result = limiter.check(
      ip,
      endpoint,
      mergedConfig.maxRequests,
      mergedConfig.windowMs,
    );

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': mergedConfig.maxRequests,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000),
    });

    if (!result.allowed) {
      res.set('Retry-After', result.retryAfter);
      return res.status(mergedConfig.statusCode).json({
        success: false,
        reason: 'rate_limit_exceeded',
        message: mergedConfig.message,
        retryAfter: result.retryAfter,
      });
    }

    next();
  };
}

/**
 * Get client IP address from request
 * Handles proxies and load balancers
 */
function getClientIp(req) {
  // X-Forwarded-For header (set by proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // X-Real-IP header (set by Nginx, etc.)
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }

  // Cloudflare
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }

  // Fallback to socket remote address
  return req.socket.remoteAddress || req.connection.remoteAddress || '127.0.0.1';
}

/**
 * Create endpoint-specific rate limiters
 * Usage:
 *   const limiter = new RateLimiter();
 *   app.post('/api/guest/login', createRateLimitMiddleware(limiter, {
 *     maxRequests: 5,
 *     windowMs: 10 * 60 * 1000, // 10 minutes
 *   }), loginHandler);
 */
export function createEndpointLimiter(maxRequests, windowMs = 60000) {
  return {
    maxRequests,
    windowMs,
  };
}
