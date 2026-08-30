import { signSession, verifySession } from '../session.js';

export const adminSessionCookieName = 'admin_session';

// Guest sessions store a raw guest id (e.g. a uuid or "guest-1"). Prefixing
// the admin session's payload before signing keeps the two namespaces
// disjoint, so a stolen/guest-controlled session cookie can never be
// replayed as an admin session (or vice versa) even though both use the
// same signing secret.
const ADMIN_SESSION_PREFIX = 'admin:';

export function signAdminSession(adminId) {
  return signSession(`${ADMIN_SESSION_PREFIX}${adminId}`);
}

export function verifyAdminSession(signedValue) {
  const value = verifySession(signedValue);
  if (!value || !value.startsWith(ADMIN_SESSION_PREFIX)) return null;
  return value.slice(ADMIN_SESSION_PREFIX.length);
}

/**
 * Express middleware protecting /admin/* routes.
 * Per PRD P0-09: no valid session -> redirect to /admin for browser
 * navigations, or 401 JSON for API/XHR requests.
 */
export function requireAdminAuth(req, res, next) {
  const signed = req.cookies && req.cookies[adminSessionCookieName];
  const adminId = verifyAdminSession(signed);

  if (!adminId) {
    if (req.accepts(['html', 'json']) === 'html') {
      return res.redirect('/admin');
    }
    return res.status(401).json({ success: false, reason: 'admin_auth_required' });
  }

  req.adminId = adminId;
  next();
}
