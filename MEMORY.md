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

[2026-08-30] Summary: Completed Next.js 14 migration from Express prototype. Scaffold includes App Router, TypeScript, guest auth flows (code + name login), personalized invitation pages, RSVP submission API, and public pages. Build verified successful. In-memory data stores with Supabase fallback configured. Next: connect to live Supabase, implement admin auth, add messaging features.

---

## Session Decisions (2026-08-30)

[2026-08-30] Decision: Migrate core application to Next.js 14 (App Router) with TypeScript
Reason: Next.js 14 is the target stack per PRD; provides server-side rendering, API routes, better performance, and foundation for Vercel deployment
Alternative considered: Continue with Express prototype longer for incremental development (rejected: diverges from PRD stack and delayed technical debt)

[2026-08-30] Decision: Use in-memory fallback data stores during development; Supabase integration to be wired in next phase
Reason: Allows local development and testing without database credentials; same code paths as Supabase when credentials present
Alternative considered: Require Supabase setup for all development (rejected: adds friction, complicates onboarding) 
