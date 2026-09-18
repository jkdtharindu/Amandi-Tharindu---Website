import crypto from 'node:crypto';

const configuredSecret = process.env.SESSION_SECRET || '';

// Production still refuses to boot without a real secret: an ephemeral one
// would silently sign every guest out on each restart or new instance.
if (!configuredSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET is required in production');
}

/**
 * Sessions are always signed. With no secret configured — a dev run, a test,
 * `node src/server.js` from a terminal — a random one is generated for the
 * life of the process.
 *
 * There used to be an *unsigned mode* instead, entered whenever SESSION_SECRET
 * was unset and NODE_ENV was not the exact string 'production'. In that mode
 * signSession returned the value untouched, so the guest_session cookie was
 * just the guest's id: `Cookie: guest_session=guest-1` signed you straight in
 * as the first guest of the fallback store, no code required. Anything that
 * wasn't literally 'production' qualified — an unset NODE_ENV, a preview
 * deploy, a typo (Next Action 33).
 *
 * Generating a secret removes the mode rather than widening the string
 * comparison that guarded it. Cookies still work within the process that
 * issued them, and are worthless anywhere else.
 */
const secret = configuredSecret || crypto.randomBytes(32).toString('hex');

const DEFAULT_GUEST_SESSION_DAYS = 30;

/**
 * How long the guest sign-in cookie lasts. Without a max age it is a browser
 * session cookie and vanishes when the browser closes — tolerable before the
 * site gate existed, but with the gate it would make guests retype their code
 * on nearly every visit.
 */
export function guestSessionMaxAgeSeconds(days = process.env.GUEST_SESSION_TTL_DAYS) {
  const parsed = Number(days);
  const valid = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GUEST_SESSION_DAYS;
  return Math.round(valid * 24 * 60 * 60);
}

export function signSession(value) {
  const signature = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${signature}`;
}

export function verifySession(signedValue) {
  if (!signedValue || typeof signedValue !== 'string') return null;
  const [value, signature] = signedValue.split('.');
  if (!value || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(value).digest('hex');

  // Buffer.from(x, 'hex') silently truncates at the first non-hex character, so
  // a forged cookie can yield a short buffer — and timingSafeEqual THROWS on a
  // length mismatch rather than returning false. Compare lengths first, or a
  // junk cookie becomes a 500 on every session-checked route.
  const provided = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (provided.length !== expectedBuffer.length) return null;

  return crypto.timingSafeEqual(provided, expectedBuffer) ? value : null;
}
