# MVP — Amandi & Tharindu Wedding Website

This file is the single place to check "what's actually still left before this site is fully done and safe." It's a short, current snapshot — not history. For the full story behind any item (why a decision was made, what was tried, what broke), see `TASKS.md`. For the original full feature spec, see `docs/amandi-tharindu-wedding-PRD.md`.

**Goal:** a working RSVP website for ~350 family-unit guests, live before the wedding on **Monday, 14 December 2026**.

**Site is live:** https://amandi-tharindu-website.vercel.app

---

## 1. What "MVP" means here

The PRD splits features into three tiers:
- **P0 — Must have.** The site doesn't work without these (guest login, RSVP, admin guest list, admin dashboard, admin login).
- **P1 — Should have.** The experience feels incomplete without these (public pages, theme editor, messaging, table planning, mobile support).
- **P2 — Nice to have.** Can wait until after launch.

The good news: **almost everything in P0 and P1 is already built.** What's left is mostly cleanup, verification, and a few owner-only actions — not new features.

---

## 2. Where things stand right now

| Area | Status |
|---|---|
| Guest login (code or name) | ✅ Done |
| Personalized invitation + RSVP (accept/decline/change) | ✅ Done, including per-person invitee RSVP |
| Sticky RSVP reminder bar | ✅ Done |
| Pre-login site gate + envelope reveal | ✅ Done |
| Public pages (Home, Our Story, Celebration, Gallery, Wishes) | ✅ Done |
| Admin login | ✅ Done (see deviation note below) |
| Admin guest management (add/edit/remove, per-person invitees) | ✅ Done |
| Admin RSVP dashboard + CSV export | ✅ Done |
| Admin theme editor (colors, fonts, wedding date/time) | ✅ Done — palette picker & hero/invitation images not built |
| Admin section manager (custom page content) | ✅ Done |
| Admin event manager | ✅ Done at MVP scope — venue image + icon picker not built |
| Admin messaging (WhatsApp reminders) | ✅ Done — manual `wa.me` links only, no auto-send |
| Table planning & seating | ✅ Done |
| Image uploads (sections/events) | ✅ Done (Vercel Blob) |
| Mobile responsiveness | ✅ Reviewed, one real defect fixed — not yet proven on a true 375px phone |
| Backups & restore | ✅ Done and rehearsed for real |
| Deployed to Vercel | ✅ Done (2026-09-10) |

Test suite: 457/457 passing as of 2026-09-12.

---

## 3. What's left before launch

### 3a. Security — do this first (real exposure right now)
- [ ] **Reset the Neon database password** and update `DATABASE_URL` in `.env` and Vercel. The current password was shared in a chat transcript and is now live in production — this is the single highest-priority open item. *(Owner-only, needs the Neon console.)*
- [ ] Delete the four already-merged GitHub branches by hand (auto-cleanup only applies going forward). *(Owner-only — needs a browser.)*

### 3b. Needs the owner's real credentials to verify
These can't be tested without logging in for real:
- [ ] Log in with a real invitation code, submit an RSVP, confirm it saves (proves the live database is really being used).
- [ ] Log in to `/admin` with the real password and confirm the real guest list appears.
- [ ] Open a WhatsApp reminder from `/admin/guests` and confirm the link starts with the real site address, not `localhost`.

### 3c. Known bugs to fix
- [x] `/api/csrf` handed out a new token on every call instead of reusing a valid one *(fixed 2026-09-13, commit `9f38a0b`; confirmed against `app/api/csrf/route.ts` on 2026-09-20)* — this has already caused a real bug (two admin panels racing on the same page). Fix at the source instead of patching each symptom.
- [ ] Add a `[Code]` placeholder to the `reminder_2` WhatsApp template before it's sent to anyone (guests need their code to get back in). *Written as migration 017; owner must run `npm run migrate` — no record of it being applied yet.*
- [ ] Decide what to do with 5 test guests still using the old code format (`SURNAME-NNN` instead of the current format) — they still work, but are inconsistent. Regenerate them or accept as-is.
*Items below marked done are built and committed locally but **not yet pushed or deployed** as of 2026-09-20 — they are not live on the site until the owner approves the push.*
- [x] Delete the legacy auth-bypass login-by-name code in `src/server.js` — leaks every matching guest's plaintext invitation code (Next Action 28). *Done 2026-09-16.*
- [x] Table Arrangement dashboard stats go stale after seat/table changes until a hard reload (Next Action 29). *Done 2026-09-18.*
- [x] `EventManager.tsx` can write duplicate `displayOrder` values when adding two events back-to-back (Next Action 30). *Done 2026-09-18.*
- [x] Both logout buttons (admin + guest) fail silently on a network error instead of showing one (Next Action 31). *Done 2026-09-18.*
- [x] Editing a guest's other details can silently overwrite a correct seat count with a stale one (Next Action 32). *Code landed 2026-09-18 — no automated test, not click-tested.*
- [x] `SESSION_SECRET`'s production guard only triggers on an exact `NODE_ENV=production` match, and the dev/no-database fallback uses guessable sequential guest IDs (Next Action 33). *Done 2026-09-18 — sessions are now always signed.*
- [x] Six Table Arrangement admin routes leak raw Postgres error text to the client (Next Action 34). *Done 2026-09-18.*
- [x] Guest RSVP `participantNames` has no size limit (Next Action 35). *Done 2026-09-18, with tests.*
- [x] Admin and guest logout routes skip CSRF verification, unlike every other state-changing route (Next Action 36). *Done 2026-09-19.*
- [x] `WhatsAppReminderModal` has no keyboard accessibility — no Escape-to-close, no focus trap (Next Action 38). *Escape and focus handling landed 2026-09-18; there is still no focus trap, and it was not click-tested.*
- [ ] Decide on a fail-closed `DATABASE_URL` guard for the 10 data stores that don't have one yet (Next Action 39).
- [ ] `message_logs.guest_id` has no `ON DELETE` clause, unlike the equivalent columns elsewhere (Next Action 40). *Migration 018 is written and committed but not applied — owner must run `npm run migrate`.*

### 3d. Content & final polish
- [ ] Fill in real content: photos, Our Story timeline, final wording on all public pages (currently placeholder/test data in places).
- [ ] Confirm no horizontal scrolling or clipping on an actual phone at 375px width — checked so far by measuring, not by holding a real device.

### 3e. Process (lower urgency, doesn't block launch)
- [ ] The HITL safety-check script (`npm run hitl:migrate`) only covers database migrations today. Deploys, sending messages, secrets changes, and pushes to `main` are still unguarded by any automated check.
- [ ] No CI check enforces any of the above yet.

---

## 4. Deliberately not building (out of scope for MVP)

- **Automatic WhatsApp/SMS/email sending** — decided against (no Twilio, cost). Admin always sends manually via a `wa.me` link.
- **Palette/font picker UI, hero image, invitation background image, custom CSS** — the database already supports these; no admin screen exists yet.
- **Event venue image upload + icon picker** — deferred, current event manager covers name/date/time/venue/address only.
- **P2 features:** nearby-hotels section, FAQ page, scheduled message campaigns, Sinhala language support.

---

## 5. Known differences from the original spec

Worth knowing so nobody "fixes" these by accident:
- Admin login is a single email + password stored in environment variables, not Supabase Auth as originally planned. There's no "forgot password" email flow because of this.
- Guest codes look like `CATEGORY-FIRSTNAME-random` (e.g. `FAMILY-NIMAL-x7k2`), not the original `SURNAME-NNN` format.
- Messaging is WhatsApp-only via manual links — no SMS, no automatic sending.

---

## 6. How to use this file

- Check items off as they're finished, and add anything new you find here.
- Once a section is fully checked off, move a short summary of it into `TASKS.md`'s history and delete it from here — this file should always read as "what's left," not a growing archive.
- Anything involving a deploy, migration, deleting data, secrets, or sending messages needs the exact HITL confirmation described in `HITL.md` — don't skip that step even for something that looks small.
