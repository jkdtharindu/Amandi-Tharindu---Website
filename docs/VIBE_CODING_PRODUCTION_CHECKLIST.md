# Vibe Coding Production Checklist
Techniques & Requirements for Secure, Scalable, Production-Ready Development

## 1. Security (Non-Negotiable)

### Core Principles
- Treat every AI-generated line as untrusted until verified.
- Never hardcode secrets, API keys, tokens, or credentials in code or prompts.
- Use environment variables + secret managers (e.g., AWS Secrets Manager, Doppler, Infisical, .env with proper .gitignore).
- Apply the principle of least privilege everywhere (DB users, IAM roles, API scopes).

### Specific Protections
- **Input validation & sanitization**: Always validate and sanitize user input on both client and server. Prefer schema validation (Zod, Joi, Pydantic, etc.).
- **Injection prevention**: Use parameterized queries / ORMs properly. Never concatenate SQL or commands.
- **Authentication & Authorization**:
  - Prefer established libraries (Auth.js, Clerk, Supabase Auth, Firebase Auth, NextAuth, etc.).
  - Implement proper session/JWT handling, refresh tokens, and short-lived access tokens.
  - Enforce role-based or attribute-based access control (RBAC/ABAC).
- **XSS / CSRF / Clickjacking**: Use modern frameworks' built-in protections + proper Content-Security-Policy headers.
- **Rate limiting & abuse protection**: Apply rate limits on auth endpoints, APIs, and expensive operations.
- **Dependency security**: Regularly scan with tools (npm audit, Snyk, Dependabot, Trivy). Pin versions and review major updates.
- **Data protection**: Encrypt sensitive data at rest and in transit (TLS everywhere). Follow data minimization.
- **Error handling**: Never leak stack traces, internal paths, or sensitive info in production responses.
- **Security headers**: HSTS, X-Frame-Options, X-Content-Type-Options, CSP, etc.
- **Multi-factor authentication (MFA)**: Require it for admin panels, internal tools, and any account with elevated access.
- **Webhook security**: Verify signatures on inbound webhooks (Stripe, GitHub, etc.) before trusting the payload.
- **Prompt hygiene**: Never paste production secrets or real PII into AI tools.

### Verification
- Run security-focused reviews on auth, payments, file uploads, and admin routes.
- Use static analysis (Semgrep, CodeQL, Sonar) and consider lightweight penetration testing for critical paths.

## 2. Backend Establishment

### Architecture & Design
- Start with a clear mental model or lightweight spec (even a short PRD or sequence of user flows) before heavy prompting.
- Prefer proven patterns: clean architecture, layered services, or well-structured modular monoliths over pure spaghetti.
- Design API contracts first (OpenAPI/Swagger) when possible.
- Choose boring, well-supported tech for the core (e.g., Postgres + proven ORMs, Redis, established frameworks).

### Database & Data Layer
- Design schema carefully (normalize where needed, denormalize intentionally for performance).
- Use migrations (Prisma Migrate, Flyway, Alembic, etc.) — never manual schema changes in production.
- Add proper indexes early for expected query patterns.
- Implement soft deletes or audit trails where business requirements demand it.
- Plan for connection pooling and avoid N+1 queries.

### API & Services
- Consistent error response format.
- Proper HTTP status codes and pagination for list endpoints.
- Idempotency keys for critical write operations (payments, order creation).
- Background jobs / queues for long-running or unreliable tasks (BullMQ, Celery, Sidekiq, Inngest, Trigger.dev, etc.).
- Structured logging (JSON logs with request IDs).

### Environment & Config
- Strict separation of development / staging / production configs.
- Feature flags for gradual rollouts.
- Health-check endpoints (`/health`, `/ready`).

## 3. Production Verification

### Testing Strategy
- **Unit tests** for pure business logic.
- **Integration tests** for database + API layers.
- **End-to-end tests** for critical user journeys (Playwright, Cypress, etc.).
- Snapshot or contract testing for APIs when useful.
- Do **not** skip tests just because AI wrote the code. AI is especially good at generating tests — use that.

### Review & Quality Gates
- Human review of security-sensitive and money-moving code is mandatory.
- Diff review: even if you "Accept All" during exploration, force yourself to read critical diffs before merging.
- Static analysis + type checking (TypeScript strict mode, mypy, etc.) in CI.
- Linting and formatting enforced.

### Deployment & Environments
- Staging environment that mirrors production as closely as possible.
- Database migrations must be reversible or carefully sequenced.
- Blue-green or canary deployments for high-traffic services.
- Smoke tests after every deployment.

### Observability
- Application Performance Monitoring (APM): Sentry, Datadog, New Relic, OpenTelemetry, etc.
- Structured logs + log aggregation.
- Metrics (request rate, error rate, latency, queue depth, DB connections).
- Alerting on error-rate spikes, latency degradation, and failed jobs.
- Distributed tracing for complex flows.

## 4. High-User / Scalability Model

### Design for Scale from Early Stages (when realistic)
- Stateless application servers (session state in Redis or JWT).
- Horizontal scaling readiness (no local file storage for user data).
- Caching strategy (Redis/Memcached for hot data, HTTP caching, CDN).
- Database:
  - Read replicas when needed.
  - Connection pooling (PgBouncer, etc.).
  - Query optimization and slow-query monitoring.
- Asynchronous processing for anything that can be delayed (emails, image processing, reports, webhooks).
- Rate limiting and back-pressure mechanisms.
- CDN for static assets and edge caching where appropriate.
- Graceful degradation and circuit breakers for external dependencies.

### Capacity & Cost Awareness
- Load testing of critical paths before major launches (k6, Locust, Artillery).
- Monitor and set budgets for AI API costs if the product itself uses LLMs heavily.
- Auto-scaling rules with sensible min/max and cool-downs.

### Multi-tenancy (if applicable)
- Clear tenant isolation (data, rate limits, resource quotas).
- Avoid noisy-neighbor problems.

## 5. Additional Critical Requirements

### Prompting & Process Discipline
- Prefer iterative, constrained prompting over giant "build the whole app" prompts for production systems.
- Maintain a living "system prompt" or project context (architecture decisions, coding standards, forbidden patterns).
- Use tools that support strong context (Cursor, Claude Projects, Windsurf, etc.) and keep the context clean.
- When AI proposes architectural changes, pause and evaluate trade-offs deliberately.

### Version Control & Collaboration
- Meaningful commit messages.
- Feature branches + pull requests even for solo work (creates a review checkpoint).
- Protect main/production branches.
- Keep AI-generated large refactors in smaller, reviewable chunks when possible.

### Documentation & Knowledge
- Document key architectural decisions (ADRs — Architecture Decision Records).
- Keep README and runbooks up to date (especially deployment, rollback, and incident response).
- Comment only the non-obvious parts; prefer self-documenting code + types.

### Compliance, Privacy & Legal (when relevant)
- GDPR / CCPA data subject rights support if handling personal data.
- Audit logging for sensitive actions.
- Clear data retention policies.
- Terms of service / privacy policy alignment with actual data practices.

### Human Oversight Rules
- Critical paths (auth, payments, data deletion, admin powers, security controls) always get human scrutiny.
- "Vibe" is excellent for scaffolding, UI, boilerplate, tests, and exploration. It is risky for final production security and complex business logic without review.
- Schedule periodic "trust but verify" sessions on the generated codebase.

### Domain, TLS Certificates & Third-Party Vendor Management
- Monitor SSL/TLS certificate expiry; use auto-renewal (Let's Encrypt, or a host-managed cert like Vercel/Netlify) rather than manual renewal.
- Track domain renewal dates; enable auto-renew and registrar lock to prevent accidental expiry or hijack.
- Keep an inventory of third-party vendors/APIs in use (auth, storage, messaging, analytics) with owner, cost, and how critical each one is.
- Periodically review dependency licenses for compliance with how the project is distributed.

### Tooling Recommendations (examples)
- Secrets: Doppler / Infisical / cloud secret managers
- Auth: Clerk, Auth.js, Supabase Auth, or battle-tested libraries
- DB: Postgres + Prisma / Drizzle / SQLAlchemy
- Queues: BullMQ, Inngest, Trigger.dev, Celery
- Monitoring: Sentry + OpenTelemetry + a metrics backend
- CI: GitHub Actions / similar with security + test gates
- Scanning: Snyk, Dependabot, Semgrep, Trivy

## Quick Decision Framework

| Area              | Vibe Freely?          | Must Verify Manually?      |
|-------------------|-----------------------|----------------------------|
| UI / scaffolding  | Yes                   | Light review               |
| Business logic    | Yes, with tests       | Yes                        |
| Auth & security   | No                    | Always                     |
| Payments / money  | No                    | Always + extra scrutiny    |
| Data migrations   | Cautiously            | Always                     |
| Scaling design    | Yes for ideas         | Architecture review        |
| Production config | No                    | Always                     |

---

**Remember**: Vibe coding accelerates building dramatically. Production reliability, security, and scalability still require engineering discipline. Use AI as a powerful junior that never gets tired — but you remain the senior engineer who owns the outcome.

## 4.1 Load & Concurrent User Testing (Required Stages)

Perform progressive load testing before each major release gate. Use tools such as k6, Locust, Artillery, or Gatling.

### Minimum Required Stages

| Stage              | Concurrent Users | When to Run                          | Success Criteria (examples)                          | Action if Failed                  |
|--------------------|------------------|---------------------------------------|-------------------------------------------------------|------------------------------------|
| Smoke / Baseline   | 10–20            | After every significant feature       | No errors, basic latency OK                            | Fix immediately                    |
| Small Scale        | **100 users**    | Before closed beta / internal release | Error rate < 1%, p95 latency within SLA                | Optimize or fix bottlenecks        |
| Medium Scale       | **500 users**    | Before public / open beta             | Error rate < 0.5%, p95 latency acceptable, no resource exhaustion | Scale infrastructure or optimize |
| High Scale         | 1,000 – 2,000+   | Before major marketing launch         | Meets defined SLOs under sustained load                | Capacity planning + auto-scaling   |
| Spike / Stress     | 2–3× expected peak | Before launch                        | System degrades gracefully, recovers after spike       | Add circuit breakers / rate limits |

### Additional Requirements
- Test realistic user journeys (login → core actions → logout), not just single endpoints.
- Include think time / pacing so the test simulates real human behavior.
- Monitor simultaneously: CPU, memory, DB connections, queue depth, error rates, and response times.
- Run tests against a staging environment that closely mirrors production (same DB size class, caching, etc.).
- Record and keep the test scripts + results in the repository for regression comparison.
- Re-run the 100-user and 500-user tests after any major performance-related change.

## 6. Cost Control & FinOps

- Set budget alerts for infrastructure (cloud spend) and AI API usage (OpenAI, Anthropic, etc.).
- Track cost per feature / per user early.
- Prefer cheaper models for non-critical tasks and reserve expensive models for complex reasoning.
- Review and prune unused resources (old databases, idle servers, unused AI keys) regularly.
- Document expected monthly cost ranges for different traffic levels.

## 7. Rollback, Incident Response & Reliability

- Maintain a tested rollback plan for every major deployment (database + application).
- Create simple runbooks for common failures (DB connection issues, high error rate, payment failures, auth outages).
- Define basic severity levels (P0 / P1 / P2) and response expectations.
- Keep a "break glass" admin access method that is audited.
- Practice at least one recovery drill (restore from backup) before public launch.
- Define RTO (Recovery Time Objective) and RPO (Recovery Point Objective) for critical data.
- Keep an on-call rotation and clear escalation contacts for P0/P1 incidents, even if it's just one person for a small project.
- Run a blameless post-incident review after every P0/P1 incident, and track its action items to completion.

## 8. Data Safety, Backups & Migrations

- Automated daily (or more frequent) backups with point-in-time recovery where possible.
- Regularly test that backups can actually be restored.
- All schema changes must go through versioned migrations.
- Dangerous migrations (column drops, large data rewrites) require a dual-write or expand-contract pattern + explicit approval.
- Soft-delete + retention policy for user data instead of immediate hard deletes when business allows.
- Document data deletion flows (GDPR/CCPA "right to be forgotten").

## 9. Feature Flags & Progressive Delivery

- Use feature flags for all significant new functionality.
- Ability to turn features off instantly without redeploying.
- Support percentage-based rollouts and user/segment targeting.
- Never leave permanent "temporary" flags; clean them up.

## 10. Technical Debt & Code Health Management

- Schedule regular "debt repayment" sessions (e.g., every 2 weeks).
- Track known AI-generated shortcuts or weak areas in a simple debt list.
- Enforce maximum file / function complexity limits where practical.
- Periodically re-prompt the AI to refactor critical modules with clearer architecture.
- Keep a short Architecture Decision Record (ADR) log for major choices.

## 11. Observability Beyond Basic Monitoring

- Business-level metrics (sign-ups, activation rate, payment success rate, core action completion).
- AI-specific metrics if your product uses LLMs (token usage, latency, error/hallucination rate, cost per request).
- User session replay or error replay tools for frontend issues (where privacy allows).
- Alert on both technical and business anomalies.

## 12. Accessibility, UX Polish & Performance Budgets

- Basic accessibility checks (keyboard navigation, contrast, screen reader landmarks).
- Define performance budgets (e.g., Largest Contentful Paint, Time to Interactive, bundle size).
- Test on low-end devices and slow networks, not only high-end machines.
- Empty states, loading states, and error states must be intentionally designed (AI often neglects these).

## 13. Legal, Privacy & Compliance Basics

- Working privacy policy and terms of service that match actual data practices.
- Cookie / tracking consent if required in your markets.
- Clear data retention and deletion mechanisms.
- Audit log for sensitive admin actions.
- If handling payments or personal data, confirm PCI / relevant compliance posture.

## 14. AI / Vibe-Coding Specific Hygiene

- Maintain a living project context / system instructions file (architecture rules, forbidden patterns, coding standards).
- Never commit AI conversation history that contains secrets.
- Review AI-suggested dependencies — hallucinated or abandoned packages are common.
- Prefer well-known, actively maintained libraries over obscure ones suggested by the model.
- After large AI-generated changes, run a full test suite + security scan before merging.
- Periodically ask the AI to "audit this module for security and edge cases" as a separate step.

## 15. Project-Specific Notes — Amandi & Tharindu Wedding Website

This section maps the general checklist above onto what this specific repository actually
uses today. It's a pointer, not a duplicate — see `TASKS.md`, `MEMORY.md`, and `HITL.md`
for full detail and history.

- **Guest personal data**: Guest records (name, phone number, RSVP status, invitation code)
  are personal data. Guests are soft-deleted, never hard-deleted. There is no documented
  retention/deletion policy yet for guest data after the wedding — needed before public
  launch (see §8 and §13 above).
- **Database access control**: Supabase/Postgres via `DATABASE_URL`. Row-Level Security
  (RLS) is NOT currently enabled. An earlier RLS migration (in an archived, unmerged branch)
  assumed Supabase Auth, which this project doesn't use, so it wasn't reusable as-is. Access
  control today relies entirely on the app's admin-auth layer, not database-level policies —
  a real gap against §1's "least privilege everywhere."
- **Admin authentication**: Env-credential (`ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`) + scrypt,
  not Supabase Auth (a deviation from the original PRD). No MFA yet, no "forgot password"
  email flow, and login throttling is in-process only — it resets if the app restarts and
  isn't shared across multiple instances (tracked as TASKS.md Next Action 8).
- **Messaging**: WhatsApp reminders use a `wa.me` deep-link, permanently (Twilio is
  confirmed off the stack — see MEMORY.md 2026-09-05). This is a deliberate, accepted
  limitation, not a gap to "fix": no delivery tracking, no auto-send, and an admin must
  click through each message by hand.
- **Rate limiting & security headers**: Tested middleware for both already exists but sits
  in an archived, unmerged branch — it is NOT yet wired into the live Next.js app. Treat
  §1's "Rate limiting" and "Security headers" items as **not yet done** for this project
  until that lands (tracked as TASKS.md Next Action 8).
- **Human oversight**: `HITL.md` is this project's concrete version of §5's "Human Oversight
  Rules" — read it before any migration, deploy, or message send to real guests.
- **Deployment status**: Not yet deployed to production (Vercel deploy is TASKS.md Next
  Action 10). Treat §3 "Deployment & Environments", §7 "Rollback, Incident Response", and
  §4.1 "Load & Concurrent User Testing" as **pending**, not done, until that ships.
