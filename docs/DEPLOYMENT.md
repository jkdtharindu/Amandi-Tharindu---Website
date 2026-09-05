# Deployment Runbook — Amandi & Tharindu Wedding Website

How to put this site online, and what to check afterwards. Written to be followed
step by step by a person, not run as a script.

**Status: not yet deployed.** Nothing below has been executed against a real Vercel
project yet. Every environment variable and file path here was read from the code on
2026-09-05 (references are given so you can re-check them), but the deploy itself is
still untested. Expect the first run to surface something this file does not predict —
and add it here when it does.

Per `HITL.md`, deploying to production is a human decision. This document prepares it;
it does not authorise it.

---

## 1. The one thing that will silently break

**Set `NEXT_PUBLIC_SITE_URL` to your real site address before sending any guest a
message.**

Two admin pages fall back to a hardcoded `http://localhost:3010` when that variable is
missing:

- `app/admin/guests/page.tsx:24`
- `app/admin/messages/page.tsx:60`

That value is passed to `buildInvitationLink(siteUrl, guest.code)` and goes straight
into the WhatsApp text you send. So if the variable is unset, **every invitation you
send contains a dead link** — `http://localhost:3010/invitation/THEIR-CODE`, which only
works on the machine that generated it. Guests would tap it and get nothing.

Nothing crashes and no error appears. The admin panel looks completely normal. This is
why it is first in this document.

Set it to the real origin with no trailing slash, e.g. `https://amandi-tharindu.com`.

---

## 2. Environment variables

Set these in the Vercel project (Settings → Environment Variables), for the Production
environment.

| Variable | Required? | What it does | Where the value comes from |
|---|---|---|---|
| `SESSION_SECRET` | **Yes** | Signs guest and admin session cookies. The app *refuses to start* in production without it (`src/session.js`). | Generate a long random string: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | The public address used to build guest invitation links. See §1. | Your real domain, no trailing slash |
| `DATABASE_URL` | **Yes** | Postgres connection string for the Supabase database. Without it the app runs on throwaway in-memory data and every guest edit vanishes on restart. | Supabase → Project Settings → Database → Connection string |
| `ADMIN_EMAIL` | **Yes** | The admin login email. | Your choice |
| `ADMIN_PASSWORD_HASH` | **Yes** | Hash of the admin password. The raw password is never stored. | `echo "your-password" \| node scripts/set-admin-password.js` — it prints the hash and nothing else |
| `GUEST_CATEGORIES` | No | Comma-separated categories used in generated invitation codes. | Defaults are built in; set only to change them |
| `SUPABASE_URL` | Only for uploads | Supabase project URL, used by the storage adapter. | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Only for uploads | Service key for storage uploads. **Secret — never commit it or paste it anywhere public.** | Supabase → Project Settings → API |
| `TRUSTED_PROXY_COUNT` | No | How many proxies sit in front of the app, used to identify callers for login rate limiting. Defaults to 1 in production, which is correct for Vercel. | Leave unset unless you add another proxy or CDN in front |

`TRUSTED_PROXY_COUNT` only exists once PR #7 is merged. If that PR is still open, ignore
that row.

**Do not** set `NODE_ENV` yourself — Vercel sets it. `PORT` is likewise handled for you.

---

## 3. Deploying

Vercel detects Next.js automatically. There is no `vercel.json` in this repo and none is
needed.

1. Merge everything you intend to ship into `main` first. Vercel deploys a branch, so
   whatever is on `main` is what goes live.
2. In Vercel, create a project and connect this GitHub repository.
3. Set every variable from §2 **before** the first deploy. A build without
   `SESSION_SECRET` fails outright with `SESSION_SECRET is required in production`, and a
   deploy without `NEXT_PUBLIC_SITE_URL` succeeds but ships broken guest links.
4. Framework preset: Next.js. Build command and output directory: leave as the defaults.
5. Deploy.
6. Point your domain at the project and confirm HTTPS is issued before sending anyone a
   link.

---

## 4. Database migrations are NOT part of the deploy

Deploying does not touch the database. Migrations are applied by hand:

```
npm run migrate          # applies any migrations/*.sql not yet recorded
```

It connects using `DATABASE_URL` from your local `.env` and records what it applied in a
`schema_migrations` table, so re-running it is safe — already-applied files are skipped.

As of 2026-09-05 the live database already has migrations `001` through `010` applied, so
a first deploy should need none. Check before assuming: run `ls migrations` and compare
against the `schema_migrations` table.

Running a migration against the live database is an **HITL checkpoint** — see `HITL.md`.

---

## 5. After deploying — check these before telling anyone the site is live

Do these in order. Each one catches a different class of failure.

1. **Open the home page.** Confirm the couple's names and the wedding date are correct —
   these come from the database (`theme_settings`), so wrong values here mean the app is
   not reading the real database.
2. **Open every public page**: `/`, `/our-story`, `/the-celebration`, `/gallery`,
   `/wishes`. No errors, no missing sections.
3. **Log in as a guest** with a real invitation code at `/login`. Then submit an RSVP and
   reload — if the answer does not persist, `DATABASE_URL` is wrong and you are on
   in-memory data.
4. **Log in as admin** at `/admin` and confirm the guest list shows your real guests.
5. **The link check — do this before messaging anyone.** On `/admin/guests`, open the
   WhatsApp reminder for any guest and read the link in the message preview. It must
   start with your real domain. If it says `localhost`, stop: `NEXT_PUBLIC_SITE_URL` is
   not set (see §1).
6. **Open the site on a phone**, not just a laptop. Most guests will.

---

## 6. If something is wrong

Vercel keeps every previous deployment. To roll back, open the project's Deployments
tab, find the last one that worked, and promote it to Production. This is instant and
does not require a git revert.

Rolling back the **application** does not roll back the **database**. If a migration
caused the problem, that has to be undone separately and deliberately — see `HITL.md`
before touching production data.

---

## 7. Deliberately not set up

Recorded so nobody wonders whether these were forgotten:

- **No staging environment.** Vercel builds a preview deployment for every pull request,
  which covers the same need for a project this size.
- **No error monitoring or alerting.** Nobody is on call for a wedding site. If something
  breaks, you will hear about it from a guest.
- **No automated deploy gates beyond CI.** Deploys are manual and human-approved by
  design (`HITL.md`).
- **No load testing.** A few hundred guests do not need it — see
  `docs/VIBE_CODING_PRODUCTION_CHECKLIST.md`, "How to Use This Checklist".

---

## 8. Still open before launch

- [ ] **Verify the guest-list backups can actually be restored.** Supabase takes backups,
      but a backup nobody has restored is only a hope. Losing the guest list close to the
      wedding is a far more realistic disaster than any attack. Do this before launch.
- [ ] Decide how long guest personal data (names, phone numbers) is kept after the
      wedding, and how it gets deleted. See `TASKS.md` Next Action 8.
