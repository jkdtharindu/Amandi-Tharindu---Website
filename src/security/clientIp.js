const DEFAULT_PRODUCTION_PROXY_COUNT = 1;

export function trustedProxyCount() {
  const raw = process.env.TRUSTED_PROXY_COUNT;
  if (raw !== undefined && raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return process.env.NODE_ENV === 'production' ? DEFAULT_PRODUCTION_PROXY_COUNT : 0;
}

/**
 * Resolve the caller's address from `X-Forwarded-For`, or null if it can't be
 * trusted. `NextRequest.ip` was removed in Next 15, so forwarded headers are the
 * only source available — and a client can put anything it likes in them.
 *
 * Each trusted proxy appends the peer it actually saw, so the real caller is the
 * Nth entry counted from the right, where N is how many proxies sit in front of
 * us. Reading the leftmost entry instead would let a caller rotate the header
 * and get a fresh rate-limit budget on every request.
 */
export function resolveClientIp(headers, options = {}) {
  const hops = options.trustedProxyCount ?? trustedProxyCount();
  if (hops < 1) {
    return null;
  }

  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) {
    return null;
  }

  const chain = forwarded
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const index = chain.length - hops;
  return index >= 0 ? chain[index] : null;
}
