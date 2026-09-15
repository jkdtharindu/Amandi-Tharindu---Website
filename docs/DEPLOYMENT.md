# Deployment Runbook — Amandi & Tharindu Wedding Website

How to put this site online, and what to check afterwards. Written to be followed
step by step by a person, not run as a script.

**Status: deployed 2026-09-10.** Live at **https://amandi-tharindu-website.vercel.app**
(Vercel project `rangajeewa-s-projects/amandi-tharindu-website`). Every environment
variable and file path here was read from the code on 2026-09-05 and re-checked
2026-09-10 against the pre-login site gate. The steps below are now confirmed against a
real deploy rather than predicted — see §9 for what changed on the first run and what
still needs the owner's own login to verify.

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

That value is passed to `buildSiteLink(siteUrl)` and goes straight into the WhatsApp
text you send (the code itself is sent as separate plain text, not baked into the link
— see Action 37, 2026-09-15). So if the variable is unset, **every message you send
contains a dead link** — `http://localhost:3010`, which only works on the machine that
generated it. Guests would tap it and get nothing.

Nothing crashes and no error appears. The admin panel looks completely normal. This is
why it is first in this document.

Set it to the real origin with no trailing slash, e.g. `https://amandi-tharindu.com`.

---

## 2. Environment variables

Set these in the Vercel project (Settings → Environment Variables), for the Production
environment.

| Variable | Required? | What it does | Where the value comes from |
|---|---|---|---|
| `SESSION_SECRET` | **Yes** | Signs guest and admin session cookies. The app *refuses to start* in production without it (`src/session.js`). **Generate a fresh value for production — do not reuse the one in your local `.env`.** The local value was pasted into a Claude Code chat transcript during the 2026-09-10 restore rehearsal (see `TASKS.md` Next Action 18), so treat it as no longer private. | Generate a long random string: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | The public address used to build guest invitation links. See §1. | Your real domain, no trailing slash |
| `DATABASE_URL` | **Yes** | Postgres connection string for the live database. Without it the app runs on throwaway in-memory data and every guest edit vanishes on restart. | **Neon** console → your project → Connection string. (Neon is the production database; Supabase below is only the local storage stack — see `docs/BACKUP_RECOVERY.md`.) **If you have not yet reset the `neondb_owner` password per `TASKS.md` Next Action 18, do that first** — a scratch-branch connection string pasted into a Claude Code chat during the 2026-09-10 restore rehearsal carried the same password, so the current value should not be trusted. |
| `ADMIN_EMAIL` | **Yes** | The admin login email. | Your choice |
| `ADMIN_PASSWORD_HASH` | **Yes** | Hash of the admin password. The raw password is never stored. | `echo "your-password" \| node scripts/set-admin-password.js` — it prints the hash and nothing else |
| `GUEST_CATEGORIES` | No | Comma-separated categories used in generated invitation codes. | Defaults are built in; set only to change them |
| `SUPABASE_URL` | Only for uploads | Supabase project URL, used by the storage adapter. | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Only for uploads | Service key for storage uploads. **Secret — never commit it or paste it anywhere public.** | Supabase → Project Settings → API |
| `BACKUP_PASSPHRASE` | Not for the deploy | Encrypts backups so they can be stored off this machine (`npm run backup:encrypt`). Set it locally, not in Vercel — backups are taken from a developer machine, not by the deployed app. | Your choice; store it somewhere retrievable that is **not** the backups folder |

**Do not** set `NODE_ENV` yourself — Vercel sets it. `PORT` is likewise handled for you.

There is no `TRUSTED_PROXY_COUNT`. An earlier draft of this file listed one, from a
security branch (PR #7) that was closed unmerged on 2026-09-09. The rate limiter that
actually shipped (`src/rate-limiter.js`) reads the first `X-Forwarded-For` entry and
takes no such variable.

---

## 3. Deploying

Vercel detects Next.js automatically. There is no `vercel.json` in this repo and none is
needed. **Done once, 2026-09-10 — see §9 for exactly what that looked like and what to
reuse for a future redeploy.**

1. Merge everything you intend to ship into `main` first. Vercel deploys a branch, so
   whatever is on `main` is what goes live.
2. Create the Vercel project and connect this GitHub repository. **The web dashboard's
   import screen (`vercel.com/new`) proved hard to navigate without seeing the screen
   directly** — labels and page layout shift with Vercel's own UI updates, and an
   unfamiliar "Connectors" flow was found and deliberately backed out of rather than
   guessed at. **Use the Vercel CLI instead** (`npm install -g vercel`, then
   `vercel login`, then `vercel link --yes --project <name>`) — see §9 for the exact
   commands and a gotcha with the project name.
3. Set every variable from §2 **before** the first deploy, or at minimum before the
   deploy anyone will see. A build without `SESSION_SECRET` fails outright with
   `SESSION_SECRET is required in production`. `NEXT_PUBLIC_SITE_URL` is the one
   exception that's fine to set *after* the very first deploy — you don't know the
   assigned domain until it exists — but redeploy immediately once it's set, since
   `NEXT_PUBLIC_` variables are baked in at build time, not read live.
4. Framework preset: Next.js. Build command and output directory: leave as the defaults.
5. Deploy.
6. Point your domain at the project and confirm HTTPS is issued before sending anyone a
   link. (Not done as of 2026-09-10 — the site is live on its Vercel-assigned domain,
   `https://amandi-tharindu-website.vercel.app`; a custom domain is optional and can be
   added later without touching any application code.)

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

Do these in order. Each one catches a different class of failure. **Items 1, 2, 5 and 6
were verified against the real 2026-09-10 deploy** (from a session with no guest or admin
credentials, so login-dependent items could not be); **3, 4 and 7 still need the owner**.

1. ✅ **Open the home page while signed out** (a private/incognito window, so no leftover
   cookie signs you in automatically). Since the pre-login site gate (P1-15, merged
   2026-09-10), a signed-out visitor to `/`, `/our-story`, `/the-celebration`, `/gallery`,
   `/wishes` or `/invitation/*` should see **only** the gate: the couple's names, a code
   field, and blurred drifting shapes — no navigation, no real page content. If real
   content appears instead, `proxy.ts` is not running (check the deploy log for a `Proxy`
   line, same as in a local build). **Confirmed 2026-09-10** on the live deploy, including
   checking the raw HTML directly (not just what renders) for every route above.
2. ✅ **Confirm the couple's names and wedding date on the gate are correct** — these come
   from the database (`theme_settings`), so wrong values mean the app is not reading the
   real database. **Confirmed 2026-09-10**: "Tharindu & Amandi" shown correctly.
3. ⬜ **Log in as a guest** with a real invitation code on the gate screen. This should play
   the envelope reveal and open that guest's invitation page. (There is no `/login` form
   any more — it redirects. Name-based login was removed with the gate; code only.) Then
   submit an RSVP and reload — if the answer does not persist, `DATABASE_URL` is wrong and
   you are on in-memory data. **Needs the owner** — no real guest code was available to a
   session without database read access to guest PII.
4. ⬜ **Confirm the guest session lasts** — sign out (clear cookies) is not needed for this
   check; just note that the cookie is set with a 30-day expiry (`GUEST_SESSION_TTL_DAYS`),
   not a session-only cookie. Revisiting the site later that day should not show the gate
   again. Depends on item 3 above.
5. ✅ **Try a wrong code** on the gate. It should show an inline error, not a page reload or
   a crash. **Confirmed 2026-09-10.**
6. ✅ **Log in as admin** at `/admin` and confirm the guest list shows your real guests.
   `/admin` is not gated, so this should reach the admin login directly. **Partially
   confirmed 2026-09-10**: the sign-in form itself loads correctly, not gated. Actually
   signing in and checking the guest list needs the owner's password.
7. ⬜ **The link check — do this before messaging anyone.** On `/admin/guests`, open the
   WhatsApp reminder for any guest and read the link in the message preview. It must
   start with your real domain (`https://amandi-tharindu-website.vercel.app`). If it says
   `localhost`, stop: `NEXT_PUBLIC_SITE_URL` is not set correctly (see §1) — though it was
   set and a redeploy triggered specifically so this check should pass; confirm anyway
   before sending anything. Separately, check the `reminder_2` template contains `[Code]`
   as well as `[Link]` — a guest who reaches the gate from that message needs the code
   typed in by hand, since the link itself no longer signs anyone in (see PRD §15). **Not
   yet done as of 2026-09-10.**
8. ✅ **Open the site on a phone**, not just a laptop. Most guests will. **Confirmed
   2026-09-10** at a real 375px viewport: no horizontal overflow, verified by DOM
   measurement (`getBoundingClientRect`/`scrollWidth`), not just a screenshot — see §9 for
   why that distinction mattered. Not yet checked on an actual physical phone.

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

- [x] **Rehearse one restore before launch.** Done 2026-09-10: 36 rows across 12 tables
      restored into a scratch Neon branch, every table matched the backup. One caveat —
      the scratch branch was created from the live database (schema already present), so
      this proves rows come back into a real Postgres but not yet a restore onto an empty
      database built by `npm run migrate` alone. See `docs/BACKUP_RECOVERY.md` and
      `TASKS.md` Next Action 14.
- [x] Set `BACKUP_PASSPHRASE` and get one encrypted backup off this laptop. Done
      2026-09-10 — see `docs/BACKUP_RECOVERY.md`.
- [ ] Decide how long guest personal data (names, phone numbers) is kept after the
      wedding, and how it gets deleted — the one remaining Tier 1 item on `TASKS.md`
      Next Action 8.
- [x] Delete the scratch Neon branch from the restore rehearsal. Done 2026-09-10
      (owner-confirmed).
- [x] Generate a fresh `SESSION_SECRET` for this deploy rather than reusing the local
      `.env` value. Done 2026-09-10 — set as the Production env var.
- [ ] **Reset the `neondb_owner` password in Neon — now the top open item.** A
      scratch-branch connection string pasted into a chat during the 2026-09-10 restore
      rehearsal carried the live database password. The owner deferred this reset and
      chose to deploy anyway (2026-09-10), so that same, already-exposed password is now
      set as `DATABASE_URL` in Vercel Production — this is the one item on this whole list
      with genuine live exposure, since the site is reachable from the internet. Reset it
      whenever convenient, then update `DATABASE_URL` in both `.env` and Vercel and
      redeploy. See `TASKS.md` Next Action 18a.

---

## 9. What the first deploy (2026-09-10) actually looked like

Recorded here because several things were not as this document, written before any
deploy had happened, assumed.

**The web dashboard was abandoned in favour of the CLI.** `vercel.com/new`'s import
screen, and the account settings needed to connect GitHub, could not be reliably
navigated by a session that cannot see the screen — labels and layout shift with
Vercel's own redesigns, and a "Connectors" flow was found and deliberately backed out of
unconfirmed rather than clicked through blind. Switching to `vercel login` (a stable,
well-documented device-code flow: visit a URL, approve, done) was far more reliable.
**If a future session repeats this:**

```bash
npm install -g vercel
vercel login --global-config "C:\Users\User\.vercel-cli-config"
# ... give the printed URL to the owner, wait for approval ...
vercel link --yes --project amandi-tharindu-website --global-config "C:\Users\User\.vercel-cli-config"
vercel env add SESSION_SECRET production --global-config "C:\Users\User\.vercel-cli-config"
# (repeat for DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, NEXT_PUBLIC_SITE_URL)
vercel deploy --prod --global-config "C:\Users\User\.vercel-cli-config"
```

**Always pass `--global-config` with the exact same path, on every single command.**
Without it, this session hit a real bug: two different `vercel login` invocations wrote
their session to two different config folders (an XDG-path resolution inconsistency
between invocations, never fully root-caused), so a login that printed "Congratulations,
you are now signed in" was then reported as logged out by the very next command. Pointing
every command at one fixed folder made it reliable.

**The GitHub repo's own name doesn't work as a Vercel project name.** The repo is
`Amandi-Tharindu---Website` — the triple dash is rejected by Vercel ("cannot contain the
sequence '---'"). The project was created instead as `amandi-tharindu-website` via
`vercel link --project <name>`.

**`vercel deploy --prod` itself was refused by this environment's own safety
classifier**, separately from the HITL checkpoint already agreed in chat — twice, for
both the first deploy and the redeploy after setting `NEXT_PUBLIC_SITE_URL`. The owner
had to run that one command themselves each time, copy-pasted from what the session
generated. Everything else (login, linking, setting env vars, reading deployment status)
ran directly from the session.

**A transient "Vercel Security Checkpoint" appeared during testing, and is not a bug.**
Vercel's own automatic traffic mitigation showed a several-second "We're verifying your
browser" page during this session's own rapid automated requests against the live site —
confirmed via `vercel firewall status` to be `Attack Mode: Off` and `Bot Protection: Off`
(neither was toggled on by anyone), so this was the automatic system-level layer
reacting to burst traffic from one source, not a setting. It cleared within seconds once
requests slowed down. A real guest browsing normally, and the whole guest list clicking
WhatsApp links spread over hours or days, should not trigger this — but if guests report
seeing it, this is where to look first, not the application code.

**A screenshot of the mobile viewport looked wrong; the DOM was actually fine.** A
375px-wide screenshot showed the gate's blurred background apparently stopping partway
across the screen, with plain white space beside it. Measuring the actual page
(`getBoundingClientRect`, `scrollWidth`, `visualViewport.width`) showed everything
correctly spanning the full 375px with no overflow — the screenshot itself was a
rendering artifact of the Browser pane tool's viewport emulation, which has had similar
issues noted before (see MEMORY.md 2026-09-06). **Trust DOM measurements over a
screenshot when checking layout width in this tool.**

**One process gap, corrected before it caused harm:** the session asked the owner to
delete the scratch Neon branch, then moved on to Vercel login troubleshooting and
deployed without re-confirming that had actually happened. It had — the owner confirmed
when asked directly, after the fact — but the deploy should not have proceeded on an
unconfirmed prerequisite. See MEMORY.md 2026-09-10 (deployment session) for the full
note.
