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
  // Support both Express req and Next.js NextRequest
  let cookieToken, headerToken;

  if (req.cookies && typeof req.cookies.get === 'function') {
    // Next.js style
    cookieToken = req.cookies.get(csrfCookieName)?.value;
    headerToken = req.headers.get(csrfHeaderName);
  } else {
    // Express style
    cookieToken = req.cookies && req.cookies[csrfCookieName];
    headerToken = req.headers[csrfHeaderName];
  }

  return (
    typeof cookieToken === 'string' &&
    typeof headerToken === 'string' &&
    cookieToken === headerToken
  );
}
