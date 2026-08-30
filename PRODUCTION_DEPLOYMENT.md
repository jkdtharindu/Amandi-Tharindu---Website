# Production Deployment Checklist

Use this checklist before deploying to production. **All items must be completed and verified.**

## Pre-Deployment Review

### 1. Security Configuration ✅

**Environment Variables**
- [ ] `NODE_ENV=production` is set
- [ ] `SESSION_SECRET` is a random 32+ character string (not default/placeholder)
- [ ] `CSRF_SECRET` is a random 32+ character string (not default/placeholder)
- [ ] All secrets are stored in hosting platform's secure storage (Vercel Secrets, etc.)
- [ ] `.env` file is NOT committed to git
- [ ] Database credentials are protected and use connection pooling

**HTTPS & TLS**
- [ ] HTTPS is enforced (all traffic redirected from HTTP → HTTPS)
- [ ] TLS certificate is valid and renewed automatically
- [ ] TLS version 1.2 or higher is enforced

**Cookies & Sessions**
- [ ] All cookies have `httpOnly: true` (prevents XSS attacks)
- [ ] All cookies have `secure: true` (HTTPS only in production)
- [ ] All cookies have `sameSite: 'lax'` or `'strict'` (CSRF protection)
- [ ] Session expiration time is set (recommend 24-48 hours for guest sessions)
- [ ] Session invalidation works on logout

### 2. Authentication & Access Control ✅

**Guest Login**
- [ ] Rate limiting is active on `/api/guest/login` (max 5 attempts per 10 minutes)
- [ ] Rate limiting is active on `/api/guest/rsvp` (max 10 updates per hour)
- [ ] Login error messages don't reveal guest existence (e.g., "Invalid code or name" not "Guest not found")
- [ ] CSRF token verification is mandatory on all POST requests
- [ ] Guests can only access their own invitation (guest code in session)

**Admin Access**
- [ ] Admin authentication is implemented (if admin panel exists)
- [ ] Admin routes are protected with session verification
- [ ] Admin actions are logged with timestamp and user IP

### 3. Input Validation & Output Encoding ✅

**Input Validation**
- [ ] Guest codes are validated: alphanumeric + hyphen only
- [ ] Guest names are validated: max 255 characters
- [ ] RSVP participant names are validated: max 50 chars each
- [ ] All JSON payloads are validated against schema
- [ ] No code injection: SQL, NoSQL, command injection tests passed

**Output Encoding**
- [ ] All guest data (names, codes) are HTML-escaped in responses
- [ ] No sensitive data in HTML comments or JavaScript
- [ ] Error messages are generic and sanitized

### 4. CSRF Protection ✅

- [ ] CSRF tokens are required on all state-changing endpoints (POST, PUT, DELETE)
- [ ] CSRF tokens are regenerated after login
- [ ] Token verification failure returns 403 Forbidden
- [ ] SameSite cookie attribute is set correctly

### 5. Data Protection ✅

**Database**
- [ ] Row-level security (RLS) is enabled in Supabase
- [ ] Guest data is only accessible to the guest's own session
- [ ] Automated backups are configured and tested
- [ ] Soft-delete is implemented (guest records are never hard-deleted)

**Logging**
- [ ] Sensitive data (codes, names, emails) is NOT logged
- [ ] Login attempts are logged (but not passwords/codes)
- [ ] Failed RSVP submissions are logged with sanitized details
- [ ] Access logs include timestamp, IP, and action (but not guest data)

**Monitoring**
- [ ] Error tracking is configured (e.g., Sentry)
- [ ] Failed login attempts are monitored
- [ ] CSRF token failures are monitored
- [ ] Database performance is monitored

### 6. Performance & Reliability ✅

- [ ] Database connection pooling is enabled
- [ ] Static assets are served with caching headers
- [ ] API responses are optimized (no N+1 queries)
- [ ] Error handling doesn't expose stack traces to users
- [ ] 404 & 500 error pages don't reveal system details

### 7. Third-Party Integrations ✅

**If using messaging (SMS/Email/WhatsApp):**
- [ ] Twilio/Resend API keys are in secure storage
- [ ] Rate limiting prevents message bombing
- [ ] Message templates don't expose sensitive guest data
- [ ] Unsubscribe/opt-out mechanism is implemented
- [ ] External API failures are handled gracefully

### 8. Compliance & Privacy ✅

- [ ] Privacy policy is published and accessible
- [ ] Data retention policy is defined (e.g., delete guest data 30 days after wedding)
- [ ] GDPR compliance is reviewed (if guests are in EU)
- [ ] Contact information is only used for wedding purposes
- [ ] Terms of Service are clear about data handling

### 9. Load Testing & Edge Cases ✅

- [ ] Load test: Can handle peak RSVP submissions (e.g., all guests in 1 hour)
- [ ] Concurrent sessions don't cause race conditions
- [ ] Database timeouts are handled gracefully
- [ ] Slow API responses don't block UI (async operations)

### 10. Security Headers ✅

Add to Express middleware:

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline';");
  next();
});
```

- [ ] `X-Content-Type-Options: nosniff` is set
- [ ] `X-Frame-Options: DENY` is set (prevents clickjacking)
- [ ] `X-XSS-Protection` is set
- [ ] `Content-Security-Policy` is configured

## Final Verification

### Testing Checklist

**Happy Path**
- [ ] Guest can login with valid code
- [ ] Guest can login with valid name (exact match)
- [ ] Guest can login with name (ambiguous match → select correct record)
- [ ] Guest can view personalized invitation
- [ ] Guest can submit RSVP (accept with names)
- [ ] Guest can change RSVP status later
- [ ] Guest can view public pages (home, story, gallery, wishes)

**Security Testing**
- [ ] Invalid code returns generic error (not "guest not found")
- [ ] RSVP submission without CSRF token fails (403)
- [ ] Rate limit is enforced (5th login attempt fails)
- [ ] Session expires after time limit (test by waiting)
- [ ] XSS attempt in guest name doesn't execute JS
- [ ] SQL injection in login attempt fails gracefully
- [ ] Guest cannot access other guest's invitation (code parameter)

**Edge Cases**
- [ ] Guest with duplicate name can disambiguate
- [ ] RSVP submission with 0 participant names is rejected
- [ ] Very long participant name is validated (max length)
- [ ] Special characters in names are handled correctly
- [ ] Network timeout during RSVP shows friendly error

### Stakeholder Sign-Off

Before go-live:
- [ ] Couple (Amandi & Tharindu) approves feature set and messaging
- [ ] Security review passed (see SECURITY.md)
- [ ] Admin has received login credentials and tested access
- [ ] Backup procedures are documented and tested

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor error logs for unexpected failures
- [ ] Check RSVP submission rate (is it reasonable?)
- [ ] Verify HTTPS is working across all pages
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Monitor database performance (query times, connection pool)

### Ongoing
- [ ] Review security logs daily for suspicious activity
- [ ] Monitor rate limit metrics (detect abuse)
- [ ] Check for failed RSVP submissions
- [ ] Monitor message delivery (if using SMS/Email)
- [ ] Weekly security audit review

## Rollback Plan

If critical issues arise post-deployment:

1. **Immediate:** Notify the couple and affected guests
2. **Assess:** Determine if rollback is needed or hotfix
3. **Rollback:** Revert to previous stable version
4. **Investigate:** Root cause analysis in staging
5. **Fix:** Apply hotfix and thorough testing
6. **Redeploy:** Only after security review complete

## Emergency Contacts

- **Couple:** [Tharindu phone/email] — for wedding-critical issues
- **Security Lead:** [your contact] — for security incidents
- **Hosting Support:** [Vercel support] — for deployment issues

## References

- [SECURITY.md](./SECURITY.md) — Security best practices
- [HITL.md](./HITL.md) — Human-in-the-loop approval process
- [README.md](./README.md) — Development setup
- [amandi-tharindu-wedding-PRD.md](./amandi-tharindu-wedding-PRD.md) — Product requirements
