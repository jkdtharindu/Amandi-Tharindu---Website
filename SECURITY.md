# Security Hardening Guide

This document outlines the security practices and requirements for the Amandi & Tharindu wedding website.

## Overview

The website handles guest data, RSVP responses, and authentication. Guests trust us to protect their personal information. All security decisions must prioritize guest privacy and data integrity.

## Authentication & Sessions

### Session Management

Session handling uses signed HTTP-only cookies to prevent XSS attacks and session hijacking:

```javascript
// Example from server.js
res.cookie('guest_session', signed, {
  httpOnly: true,        // Prevents JavaScript access (XSS protection)
  sameSite: 'lax',       // Prevents CSRF and cross-site request attacks
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
  path: '/',
});
```

**Requirements:**
- `SESSION_SECRET` must be a long, random string (min 32 characters)
  - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - Store in `.env` (never commit to git)
- In production, ALL cookies must be marked `secure` (HTTPS only)
- Session expiration should be enforced (implement TTL for guest_session)
- Sessions must be invalidated after logout

### Password & Code-Based Login

Current implementation uses **invitation codes** and **name-based lookup** for guest access:

- Codes are single-use identifiers (not passwords)
- Name lookups support disambiguation for multiple matches
- No passwords are stored or transmitted

**Best practices to maintain:**
- Never store plaintext passwords
- Codes should be randomly generated and unique per guest
- Implement rate limiting on login attempts (max 5 attempts per 10 minutes per IP)
- Log failed login attempts for security monitoring

## CSRF Protection

Cross-Site Request Forgery (CSRF) is mitigated via token verification:

```javascript
// From server.js
if (!verifyCsrfToken(req)) {
  return res.status(403).json({ success: false, reason: 'csrf_invalid' });
}
```

**How it works:**
1. Server generates unique CSRF token per session (stored in cookie)
2. Client includes token in `x-csrf-token` header
3. Server verifies token before processing state-changing requests (POST, PUT, DELETE)

**Token lifecycle:**
- Generated on GET requests (first page load)
- Refreshed after login
- Must be sent with all POST/RSVP requests

**To maintain CSRF protection:**
- Never disable CSRF checks for ANY endpoint
- Regenerate tokens after login
- Use SameSite cookie attributes (currently set to 'lax')

## Input Validation & Sanitization

### Current validation:
- Guest codes: String pattern matching (e.g., `SILVA-001`)
- Guest names: Trimmed and validated for non-empty
- RSVP data: Boolean validation for attendance, array validation for participant names

### Required validation:
- Whitelist allowed characters for codes (alphanumeric, hyphen)
- Limit input lengths (name < 255 chars, participant names < 500 chars total)
- Escape HTML output in invitation pages to prevent XSS
- Validate all JSON payloads against expected schema

### SQL Injection Prevention:
- Use parameterized queries (built-in with Supabase/pg)
- Never concatenate user input into SQL strings
- Validate data types before database operations

## Rate Limiting

**Not yet implemented** — must add before production:

```javascript
// Pseudo-code for rate limiting middleware
const rateLimit = {
  '/api/guest/login': { max: 5, window: 600000 }, // 5 attempts per 10 min
  '/api/guest/rsvp': { max: 10, window: 3600000 }, // 10 updates per hour
};
```

Recommended approach:
- Use `express-rate-limit` package
- Track by IP address + guest code (if authenticated)
- Return 429 (Too Many Requests) on limit exceeded
- Log rate limit breaches for monitoring

## Data Protection

### Guest Data Handling

Guest data includes:
- Name, relationship, contact info (optional)
- RSVP status and participant names
- Session identifiers

**Privacy requirements:**
- Never log full names or codes in error messages shown to users
- Sanitize error messages to not reveal guest existence
- Implement access control: guests can only see their own invitation
- Log all access to guest data with timestamps and IPs (for audit trail)

### Data at Rest (Database)
- Enable row-level security (RLS) in Supabase
- Encrypt sensitive fields (contact info) if added
- Regular backups stored securely
- Implement soft-delete for guest records (never hard-delete live data)

### Data in Transit
- HTTPS enforced in production (NODE_ENV=production)
- TLS 1.2+ required
- Secure cookies only over HTTPS

## Environment Variables

**NEVER commit `.env` to git.** Critical variables:

| Variable | Purpose | Example | Notes |
|----------|---------|---------|-------|
| `NODE_ENV` | Runtime mode | `production` or `development` | Controls security features |
| `DATABASE_URL` | Postgres connection | `postgres://user:pass@host/db` | Keep private, use connection pooling |
| `SESSION_SECRET` | Cookie signing key | Random 32+ char string | Rotate periodically in production |
| `CSRF_SECRET` | CSRF token signing | Random 32+ char string | Keep private |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` | Public, but validate origin |
| `SUPABASE_ANON_KEY` | Public API key | `eyJhbGc...` | Use carefully, restrict scope |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key | `eyJhbGc...` | **NEVER expose**, use only server-side |

**Secrets management:**
- Use `.env.local` for local development (git-ignored)
- Use Vercel Secrets for staging/production
- Rotate sensitive keys if compromised
- Audit key access logs in Supabase dashboard

## Production Deployment Checklist

Before deploying to production:

- [ ] `NODE_ENV=production` is set
- [ ] All cookies have `secure: true`
- [ ] HTTPS is enabled and enforced
- [ ] SESSION_SECRET is a random 32+ character string
- [ ] Rate limiting is active on all auth endpoints
- [ ] CSRF protection verified on all state-changing endpoints
- [ ] Error messages don't leak guest names or system details
- [ ] Logging is configured (don't log sensitive data)
- [ ] Database backups are tested and automated
- [ ] Access logs are monitored for suspicious patterns
- [ ] Security headers are set (in production middleware)

## Common Security Mistakes to Avoid

❌ **Don't:**
- Store sessions in local storage (vulnerable to XSS)
- Use plain-text passwords
- Log sensitive data (codes, names, IPs)
- Disable CSRF checks
- Skip HTTPS in production
- Commit `.env` files to git
- Use weak session secrets

✅ **Do:**
- Use HTTP-only, Secure cookies
- Implement rate limiting
- Validate all inputs
- Log access attempts (sanitized)
- Test security on staging before production
- Monitor for unusual activity
- Review security regularly

## Monitoring & Incident Response

### What to Monitor

- Failed login attempts (rate spikes indicate brute force)
- CSRF token failures (may indicate attacks)
- Unusual access patterns (same guest accessing multiple codes)
- Database errors (may indicate injection attempts)

### Incident Response

If a security issue is discovered:

1. **Immediate:** Notify the couple immediately (jkdtharindu@gmail.com)
2. **Assess:** Determine scope, affected guests, data exposed
3. **Contain:** Disable affected features if necessary
4. **Investigate:** Review logs, identify root cause
5. **Notify:** Communicate transparently with affected guests
6. **Remediate:** Apply fixes, test thoroughly
7. **Post-mortem:** Document lessons learned

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [HITL.md](./HITL.md) — Human-in-the-loop approval requirements

## Questions?

Contact the development team before making any security-related changes. When in doubt, assume it's sensitive and apply the HITL approval process.
