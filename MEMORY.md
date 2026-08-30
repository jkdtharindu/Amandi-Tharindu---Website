This file is append-only for decisions.
Do not rewrite history — add new entries with dates.

Project: Amandi & Tharindu Wedding Website
Start date: 2026-08-09

1) Architectural decisions (with date and reason)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


2) Technology choices and why alternatives were rejected

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


3) Past mistakes and corrections (things the AI got wrong before)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


4) Deprecated patterns (old approaches we've moved away from)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


5) Last session summary (leave blank — Claude will fill this in)

[2026-08-30] Summary: 
- ✅ Completed Next.js 14 migration from Express prototype
- ✅ Implemented Supabase integration layer (3-tier database support)
- ✅ All guest flows (login, RSVP) wired to Supabase with fallback
- ✅ Admin authentication (Supabase Auth + context provider)
- ✅ Route protection middleware for /admin/* paths
- ✅ Basic admin dashboard (guest list + statistics)
- ✅ Build verified successful
Next: Guest edit/add forms, then messaging center

---

## Session Decisions (2026-08-30)

[2026-08-30] Decision: Migrate core application to Next.js 14 (App Router) with TypeScript
Reason: Next.js 14 is the target stack per PRD; provides server-side rendering, API routes, better performance, and foundation for Vercel deployment
Alternative considered: Continue with Express prototype longer for incremental development (rejected: diverges from PRD stack and delayed technical debt)

[2026-08-30] Decision: Use in-memory fallback data stores during development; Supabase integration wired but optional
Reason: Allows local development and testing without database credentials; same code paths as Supabase when credentials present
Alternative considered: Require Supabase setup for all development (rejected: adds friction, complicates onboarding)

[2026-08-30] Decision: Three-tier database support (in-memory fallback | local Postgres | Supabase cloud)
Reason: Supports all developer workflows (zero-setup, local testing, production-like)
Implementation: isSupabaseConfigured() checks env vars; all queries work with both stores
Migration & seed scripts use pg client directly for both Supabase and local Postgres

[2026-08-30] Decision: Use Supabase Auth (not custom JWT) for admin authentication
Reason: Built-in provider eliminates session management complexity; built-in MFA/email verification for future
Alternative: Custom session system (rejected: reinvents wheel, requires encryption management)

[2026-08-30] Decision: Protect /admin/* routes with middleware + in-client context provider
Reason: Middleware blocks non-authenticated requests server-side; context provider keeps UI in sync on client
Implementation: middleware.ts checks admin_session cookie; AdminProvider listens to auth state changes

[2026-08-30] Decision: Generate guest IDs with uuid for admin-created guests
Reason: Ensures uniqueness and consistency; same ID format as database records
Alternative: Sequential numeric IDs (rejected: inconsistent with query return types)

[2026-08-30] Decision: Use soft delete for guest removal (is_deleted flag, not hard delete)
Reason: Preserves referential integrity with RSVP responses; audit trail for deletions
Implementation: All guest queries filter out is_deleted=true; DELETE endpoint sets flag instead of removing row 
