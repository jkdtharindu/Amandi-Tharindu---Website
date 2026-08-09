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
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
    ? value
    : null;
}
