# Security, Reliability & Backups — 2026-09-06

Working notes for the hardening pass. The durable record lives in `TASKS.md`
(Next Actions 8, 9, 14) and `docs/BACKUP_RECOVERY.md`; this file is the summary.

## Shipped

### 1. Guest login rate limiting

10 attempts per 10 minutes per client, then `429` with a `Retry-After`. Lives in
`src/rate-limiter.js` and is wired into both the Next.js route
(`app/api/guest/login/route.ts`) and the Express prototype (`src/server.js`), the
latter so the existing HTTP test suite can actually exercise it.

This matters because InvitationCodes are guessable by design — they are printed
on a card, so they are short, human-readable, and cannot be rotated once posted.
Nothing else stood between an outsider and the guest list.

Verified live, not just asserted: attempts 1–10 answered normally, the 11th
returned 429.

**Caveat, and it is a real one:** the counter is per-process. It resets on
redeploy and does nothing across multiple instances. On a single always-on
instance it works as intended; on serverless it is substantially weaker.

### 2. Image validation by magic bytes — now actually enforced

`src/image-validator.js` checks the JPEG/PNG/WebP file signature, and is now
called from `/api/admin/upload` in `src/server.js`.

The gap it closes: multer's `fileFilter` can only see the `Content-Type` the
client chose to send. A renamed executable declaring `image/png` passed the old
check, and that declared type was then handed to Supabase as the stored object's
content type. The bytes are the only trustworthy statement about a file.

Note this endpoint exists **only in the legacy Express prototype** — the live
Next.js app has no upload route at all, so there was no production exposure. Wire
this same check in when upload ships to the Next.js app.

### 3. Security headers via `proxy.ts`

Three corrections to the first attempt at this:

- The file was written as `middleware.ts`. Next.js 16 **deprecated that name in
  favour of `proxy.ts`** (`node_modules/next/dist/docs/.../middleware.md`), and
  `.env.example` already referred to `proxy.ts`. Renamed.
- The CSP had no `'unsafe-eval'` in development, which silently broke React's dev
  overlay and stack traces. Now dev-only; production stays strict.
- `X-XSS-Protection` removed. The legacy XSS auditor is deprecated and was itself
  a source of vulnerabilities; CSP is the replacement. Also dropped the dead
  `X-Download-Options` (IE8) and `X-DNS-Prefetch-Control`. Added `object-src`,
  `base-uri` and `form-action`.

`'unsafe-inline'` stays, deliberately. The alternative is a per-request nonce,
which requires dynamic rendering and would cost the public pages their static
generation. Revisit only after inline scripts/styles are removed.

### 4. Backups — the critical gap

`npm run backup` / `npm run backup:verify`. Tables are discovered from the
database catalog rather than hardcoded, so a future migration cannot silently
leave its table unbacked. First real backup taken: 36 rows across 12 tables.

`backups/` is gitignored and must stay so — **the files contain every guest's
name, phone number and email.**

Full procedure, including restore ordering and the FK-safe table sequence, is in
`docs/BACKUP_RECOVERY.md`.

### 5. Two fixes found along the way

- **Login page ignored the theme.** It hardcoded Tailwind blues instead of the
  theme variables every other page uses, so the admin's Theme Editor did not
  reach the guest entry page. Moved onto the shared `.button`/`.button-primary`
  classes.
- **RSVP write consistency.** `upsertRsvpResponse` and `updateGuestRsvpStatus`
  are two separate calls; a failure between them left the response saved and the
  status stale. Now the status failure is caught and logged rather than failing
  the request, so the guest's actual decision is never lost. A single
  transaction would be better and is not done.

## Verification

- `npm test` — 338/338 passing (6 new: 4 rate-limit over HTTP, 2 upload-content)
- `npm run build` — clean, `Proxy` registered
- `npm run lint` — no new problems; all remaining ones are pre-existing
  (`Countdown.tsx`, `append-memory.js`, `ci-check-docs.js`)
- Headers and the 429 confirmed against a running server, not just unit-tested
- Public pages reviewed at 375×812

## Still open

Needs a browser and an account, so it could not be done from here:

- **Confirm Neon's point-in-time retention window**, and **rehearse one restore**
  into a scratch branch. Until that rehearsal, "we have backups" is untested.
- Choose an off-machine home for backup files.
- Vercel deploy and production env vars, incl. `NEXT_PUBLIC_SITE_URL`.

Needs a decision:

- P1-15 pre-login gate — three product questions, still unanswered.

Known weaknesses, written down rather than left implied:

- Rate limiting is per-process (above).
- CSRF tokens are pure double-submit with no TTL. An attacker sets both cookie
  and header to the same arbitrary value and passes. That is fine for its actual
  job (cross-site forgery) but it is **not** an authentication control, and the
  rate limiter is doing the real work on the login endpoint.
- Admin surfaces have had no mobile review; that needs the admin password.
- Uploaded images are not backed up, and there is no malware scanning. Neither
  matters until upload ships to the live app. Both matter the day it does.
