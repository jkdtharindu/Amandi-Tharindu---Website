import crypto from 'node:crypto';

export const csrfCookieName = 'csrf_token';
export const csrfHeaderName = 'x-csrf-token';

export function getOrCreateCsrfToken(req, res) {
  const existing = req.cookies && req.cookies[csrfCookieName];
  if (existing && typeof existing === 'string' && existing.length >= 64) {
    return existing;
  }

  const token = crypto.randomBytes(48).toString('hex');
  res.cookie(csrfCookieName, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return token;
}

export function verifyCsrfToken(req) {
  const cookieToken = req.cookies && req.cookies[csrfCookieName];
  const headerToken = req.headers[csrfHeaderName];
  return (
    typeof cookieToken === 'string' &&
    typeof headerToken === 'string' &&
    cookieToken === headerToken
  );
}
