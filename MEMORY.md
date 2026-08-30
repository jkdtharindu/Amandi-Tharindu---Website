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
- ✅ Completed Next.js 14 migration from Express prototype (scaffold + auth + pages)
- ✅ Implemented Supabase integration layer (lib/supabase.ts, lib/auth.ts updates)
- ✅ All guest flows (login, RSVP) wired to Supabase with in-memory fallback
- ✅ Migration & seed scripts updated for real database
- ✅ Build verified successful
Next: Wire to live Supabase credentials, implement admin auth, add messaging

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
