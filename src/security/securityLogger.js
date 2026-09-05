/**
 * Structured, sanitising logger for security-relevant events.
 *
 * Ported from `archive/claude/mobile-only-session-qj1ixz-2026-09-04`
 * (`src/request-logger.js`), keeping only the parts that work here. That branch
 * also carried an Express `requestLoggerMiddleware`, which was deliberately not
 * ported: it hangs off `res.on('finish')` and `req.ip`, neither of which exists
 * in the Next.js route handlers that serve production — `src/server.js` is the
 * legacy prototype. Per-request logging for the real app belongs at the platform
 * edge, not in a middleware this codebase would have to fake.
 *
 * Everything written here goes to stdout/stderr as one JSON object per line, so
 * a log aggregator can parse it. Guest data must never reach those lines: this
 * project's PII is exactly the fields people log by reflex (name, invitation
 * code), and logs are the easiest place to leak them from.
 */

const SENSITIVE_FIELDS = new Set([
  'code',
  'invitationCode',
  'invitation_code',
  'name',
  'guestName',
  'guest_name',
  'password',
  'token',
  'csrfToken',
  'csrf_token',
  'sessionId',
  'session_id',
  'whatsappNumber',
  'whatsapp_number',
  'email',
]);

const MASK = '***';

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Reduce an address to something coarse enough to be safe in a log line but
 * still useful for spotting one caller hammering an endpoint.
 *
 * Anything that is not recognisably an address becomes `unknown` rather than
 * being echoed: the value ultimately comes from a request header, so a caller
 * chooses it, and an unfiltered header is how log injection gets in.
 */
export function maskIpAddress(ip) {
  if (typeof ip !== 'string' || ip === '') {
    return 'unknown';
  }

  const v4 = ip.match(IPV4);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    if (octets.every((octet) => octet <= 255)) {
      return `${octets[0]}.${octets[1]}.*.*`;
    }
    return 'unknown';
  }

  // IPv6: keep enough leading groups to identify a network, drop the rest.
  const groups = ip.split(':').filter(Boolean);
  if (groups.length >= 3 && groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) {
    return `${groups.slice(0, 3).join(':')}:${MASK}`;
  }

  return 'unknown';
}

/**
 * Strip guest identifiers out of a path before it is logged. Invitation codes
 * and names are the two things that identify a real person here.
 */
export function sanitizePath(path) {
  if (typeof path !== 'string' || path === '') {
    return '';
  }

  return path
    .replace(/\/invitation\/[^/?#]+/gi, '/invitation/***')
    .replace(/([?&](?:code|name)=)[^&#]*/gi, `$1${MASK}`);
}

function sanitizeValue(value, seen) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, seen));
  }

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? MASK : sanitizeValue(entry, seen);
  }
  return result;
}

/**
 * Mask sensitive fields at any depth. A shallow pass would miss the common
 * shape — a guest object nested inside the thing being logged.
 */
export function sanitize(data) {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  return sanitizeValue(data, new WeakSet());
}

export class SecurityLogger {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    // Stacks name internal paths, so they stay out of production logs.
    this.includeStack = options.includeStack ?? process.env.NODE_ENV !== 'production';
  }

  _write(stream, entry) {
    if (!this.enabled) {
      return;
    }
    stream(JSON.stringify({ timestamp: new Date().toISOString(), ...entry }));
  }

  info(message, data) {
    this._write(console.log, { level: 'info', message, data: sanitize(data) });
  }

  warn(message, data) {
    this._write(console.warn, { level: 'warn', message, data: sanitize(data) });
  }

  error(message, error, data) {
    this._write(console.error, {
      level: 'error',
      message,
      error: error ? error.message : null,
      ...(this.includeStack && error?.stack ? { stack: error.stack } : {}),
      data: sanitize(data),
    });
  }

  /**
   * A security event worth reviewing later. Always a warning: these lines exist
   * to be alerted on, not to be scrolled past.
   */
  security(event, details) {
    this._write(console.warn, {
      level: 'warn',
      event_type: 'security',
      event,
      details: sanitize(details),
    });
  }

  /**
   * A login attempt. The identifier that was tried is deliberately dropped
   * rather than masked in place: on a failed guest login it is a guessed
   * invitation code, and on a successful one it is a real guest's.
   *
   * @param {{ success: boolean, endpoint: string, ip?: string | null, reason?: string | null }} attempt
   */
  loginAttempt({ success, endpoint, ip, reason = null }) {
    this.security(success ? 'login_success' : 'login_failed', {
      endpoint,
      ip: maskIpAddress(ip),
      reason,
    });
  }

  /**
   * A caller that just hit a rate limit — the signal that someone is guessing.
   *
   * @param {{ endpoint: string, ip?: string | null }} event
   */
  rateLimited({ endpoint, ip }) {
    this.security('rate_limited', { endpoint, ip: maskIpAddress(ip) });
  }
}

export const securityLogger = new SecurityLogger();
