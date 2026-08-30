# Supabase Row Level Security (RLS) Setup Guide

## Overview

Row Level Security (RLS) enforces access control at the **database level**, preventing unauthorized data access even if the application layer is compromised.

**For this wedding website:**
- Guests can only access their own invitation and RSVP data
- Admin can access all guest data (implemented later)
- All policies are enforced by Supabase, not just the app

---

## Architecture

### Data Access Layers

```
┌─ Application Layer (server.js) ────┐
│  • Validate request                │
│  • Check CSRF token                │
│  • Verify session                  │
│  • Build SQL query                 │
└─────────────────────────────────────┘
                 ↓
┌─ Database Layer (Supabase) ────────┐
│  • Check RLS policies              │
│  • Enforce row-level access        │
│  • Return only authorized rows     │
└─────────────────────────────────────┘
```

**If app layer is bypassed**, RLS still protects data. If RLS is bypassed, app layer still prevents unauthorized requests.

---

## Current Policies

### Guests Table

| Action | Guest Can | Policy |
|--------|-----------|--------|
| SELECT | Own record only | Checked at app layer |
| UPDATE | Own RSVP status | `id = auth.uid()` |
| INSERT | No | `WITH CHECK (false)` |
| DELETE | No | `USING (false)` |

### RSVP Responses Table

| Action | Guest Can | Policy |
|--------|-----------|--------|
| SELECT | Own RSVP only | `guest_id = current_user` |
| INSERT | Own RSVP | `guest_id = current_user` |
| UPDATE | Own RSVP | `guest_id = current_user` |
| DELETE | No | `USING (false)` |

---

## Implementation Steps

### Step 1: Enable RLS in Supabase Dashboard

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy contents of `migrations/003_enable_rls.sql`
5. Click **Run**
6. Verify: SQL should complete with no errors

### Step 2: Verify Policies Are Active

Run this query in SQL Editor:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

You should see policies for `guests` and `rsvp_responses` tables.

### Step 3: Test RLS Policies

#### Test 1: Guest Can View Own Record

```sql
-- Simulate guest viewing their own record
-- In real app: JWT auth handles this

SELECT * FROM public.guests
WHERE id = 'guest-id-here';  -- Should return record
```

#### Test 2: Guest Cannot View Other Guests

```sql
-- This should be blocked by RLS in production
-- (In direct SQL without auth, it may still show data)

SELECT * FROM public.guests
WHERE id != 'current-guest-id';  -- Should be blocked
```

#### Test 3: Guest Cannot Insert New Guests

```sql
-- This should always be blocked by RLS

INSERT INTO public.guests (code, name, relationship)
VALUES ('TEST-001', 'Hacker', 'none');  -- Should fail
```

---

## JWT Authentication in Supabase

### How It Works

1. Guest logs in via app: `/api/guest/login`
2. App creates session (currently using HTTP-only cookie)
3. For future enhancement: exchange session for JWT
4. JWT includes: `{ sub: guest_id, role: 'guest', ... }`
5. Supabase checks JWT claims against RLS policies

### Updating Session to JWT (Future)

Currently: Session stored in HTTP-only cookie
Future: Add JWT for Supabase direct access

```javascript
// Future enhancement:
const jwt = generateSignedJWT({
  sub: guest.id,           // Subject = guest ID
  role: 'guest',           // Role for RLS policies
  aud: 'authenticated',    // Audience
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
});
```

---

## Production Readiness Checklist

Before deploying to production:

- [ ] RLS policies are enabled on all tables
- [ ] Test policies with real data in staging
- [ ] Verify guests can only access own data
- [ ] Verify admins can access all data (when admin auth added)
- [ ] Update app to use Supabase client with JWT
- [ ] Enable auth JWT in middleware for DB queries
- [ ] Document RLS policy changes in code comments
- [ ] Audit policy logic for security gaps
- [ ] Test with Supabase CLI locally

---

## Supabase Client Setup (Future)

When migrating to use Supabase client directly:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false, // Session managed by app
    },
  }
);

// Set JWT for authenticated requests
supabase.auth.setSession({
  access_token: jwtToken,
  refresh_token: null,
  type: 'bearer',
});

// Now all queries include JWT auth
const { data, error } = await supabase
  .from('guests')
  .select('*');
// RLS automatically filters based on JWT sub
```

---

## Common RLS Patterns

### Pattern 1: User Owns Record

```sql
CREATE POLICY user_owns_record
  ON table_name
  FOR SELECT
  USING (user_id = auth.uid());
```

Guest can only view their own row.

### Pattern 2: User Cannot Modify Certain Columns

```sql
CREATE POLICY user_update_only_status
  ON table_name
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid() AND
    rsvp_status IN ('accepted', 'declined')  -- Only allow valid statuses
  );
```

Prevents guests from modifying restricted fields.

### Pattern 3: Admin Can See Everything

```sql
CREATE POLICY admin_bypass
  ON table_name
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );
```

Admin role bypasses guest restrictions.

### Pattern 4: Anonymous Read-Only Access

```sql
CREATE POLICY public_read
  ON public_table
  FOR SELECT
  USING (is_public = true);
```

For public pages (wishes, gallery).

---

## Monitoring & Debugging

### View Active Policies

```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### Check Who Accessed What

Supabase logs all database queries. Enable:
1. Dashboard → Monitoring → Query Performance
2. Set up alerts for policy violations

### Test Policy Enforcement

```sql
-- Enable debug mode (development only)
SET log_statement = 'all';

-- Run test query
SELECT * FROM public.guests;

-- Check logs in Supabase dashboard
```

---

## Troubleshooting

### Issue: "New row violates row-level security policy"

**Cause:** Policy `WITH CHECK` clause failed

**Solution:** Verify the INSERT/UPDATE request includes correct `guest_id`

```sql
-- Check policy
SELECT * FROM pg_policies
WHERE tablename = 'rsvp_responses' AND policyname = 'rsvp_insert_own';

-- Test with explicit values
INSERT INTO public.rsvp_responses (guest_id, attending)
VALUES ('correct-guest-id', true);
```

### Issue: "SELECT returned no rows"

**Cause:** RLS filtered out all results (guest doesn't own the record)

**Solution:** Verify JWT includes correct `sub` (guest ID)

```sql
-- Check JWT claims
SELECT auth.jwt() as jwt;
```

### Issue: Admin Cannot Access Guest Data

**Cause:** Admin policy not yet implemented

**Solution:** Add admin bypass policy once admin auth is added

```sql
CREATE POLICY admin_all_access
  ON public.guests
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

## Security Best Practices

1. **Always enable RLS** — No exceptions
2. **Test policies thoroughly** — Use staging database
3. **Document policies** — Explain USING and WITH CHECK clauses
4. **Review policies regularly** — Audit for gaps
5. **Never disable policies** — Even for "just testing"
6. **Use JWT claims** — For role-based access
7. **Combine with app validation** — Defense in depth

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Data Access Control](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Security.md](../SECURITY.md) — Overall security guide

---

## Next Steps

1. **Apply this migration** in Supabase SQL Editor
2. **Test policies** with staging data
3. **Update application** to use Supabase JWT auth (future)
4. **Add admin policies** when admin auth is implemented
5. **Monitor policy violations** in production

Questions? Review the SECURITY.md document or Supabase RLS docs.
