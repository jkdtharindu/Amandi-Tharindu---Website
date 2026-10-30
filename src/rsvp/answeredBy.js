import crypto from 'node:crypto';

/**
 * A short, one-way label for "which device saved this answer", built from the
 * request's network address. Only the label is stored, never the address, and it
 * is keyed with the site secret so it cannot be reversed by guessing addresses.
 *
 * It is a gentle safeguard, not a lock: a phone moving between wifi and mobile
 * data looks like a new device, and two people on one wifi look the same. The
 * page asks before changing, so a false alarm costs one extra tap.
 *
 * Returns null when there is no usable address; callers then skip the check.
 *
 * @param {string | null | undefined} ip
 * @returns {string | null}
 */
export function answeredByLabel(ip) {
  const address = typeof ip === 'string' ? ip.trim() : '';
  if (!address || address === 'local') return null;
  const secret = process.env.SESSION_SECRET || 'dev-only-answered-by';
  return crypto.createHmac('sha256', secret).update(address).digest('hex').slice(0, 32);
}

/** The first address in x-forwarded-for, the way the admin login reads it. */
export function clientIpFrom(headers) {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
}
