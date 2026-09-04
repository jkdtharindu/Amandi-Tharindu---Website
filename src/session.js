import crypto from 'node:crypto';

const secret = process.env.SESSION_SECRET || '';
const useSignature = Boolean(secret);
if (!useSignature && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET is required in production');
}

export function signSession(value) {
  if (!useSignature) {
    return value;
  }
  const signature = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${signature}`;
}

export function verifySession(signedValue) {
  if (!signedValue || typeof signedValue !== 'string') return null;
  if (!useSignature) {
    return signedValue;
  }
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
