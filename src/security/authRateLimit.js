import { RateLimiter, rateLimitHeaders } from './rateLimiter.js';
import { resolveClientIp } from './clientIp.js';

export const GUEST_LOGIN_LIMIT = { maxRequests: 20, windowMs: 10 * 60 * 1000 };
export const ADMIN_LOGIN_LIMIT = { maxRequests: 8, windowMs: 15 * 60 * 1000 };

const SHARED_BUCKET = 'unidentified';

const limiter = new RateLimiter();

/**
 * Rate-limit an unauthenticated auth attempt.
 *
 * When the caller can't be identified (no trusted proxy in front of us) the
 * choice is between one shared bucket and no limit at all. In production we take
 * the shared bucket — failing open on a login endpoint is worse than the risk of
 * one caller consuming everyone's budget — but locally that would just block the
 * developer, so there we skip it.
 */
export function checkAuthRateLimit(headers, endpoint, limit) {
  const ip = resolveClientIp(headers);

  if (ip === null && process.env.NODE_ENV !== 'production') {
    return { identifier: null, allowed: true, retryAfter: null, headers: {} };
  }

  const identifier = ip ?? SHARED_BUCKET;
  const result = limiter.check(identifier, endpoint, limit.maxRequests, limit.windowMs);

  return {
    identifier,
    allowed: result.allowed,
    retryAfter: result.retryAfter,
    headers: rateLimitHeaders(result, limit.maxRequests),
  };
}

export function clearAuthRateLimit(identifier, endpoint) {
  if (identifier) {
    limiter.clear(identifier, endpoint);
  }
}
