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
| Guest login (invitation code only) | ✅ Done — login-by-name was removed 2026-09-16 for security |
| Personalized invitation + RSVP (accept/decline/change) | ✅ Done, including per-person invitee RSVP. Saving is all-or-nothing since 2026-09-20; a live test RSVP worked (owner-reported) |
| Sticky RSVP reminder bar | ✅ Done |
| Pre-login site gate + envelope reveal | ✅ Done |
| Single-page homepage (Home, Our Story, Family Details, Event Details, FAQ, Gallery, closing message) | ✅ Done — the old page URLs redirect to sections; Family Details and Gallery are admin-editable |
| Admin login | ✅ Done (see deviation note below) |
| Admin guest management (add/edit/remove, per-person invitees) | ✅ Done |
| Admin RSVP dashboard + CSV export | ✅ Done |
| Admin theme editor (colors, fonts, wedding date/time, hero photo) | ✅ Done — palette/font picker screen & invitation background image not built |
| Admin section manager (custom page content) | ✅ Done |
| Admin event manager | ✅ Done at MVP scope, including venue photo upload — icon picker not built |
| Admin messaging (WhatsApp reminders) | ✅ Done — manual `wa.me` links only, no auto-send |
| Table planning & seating | ✅ Done |
| Image uploads (sections/events) | ✅ Done (Vercel Blob) |
| Admin gallery manager (upload, reorder, delete) | ✅ Done |
| Security & logic audit fixes (Next Actions 28–36, 38, 40) | ✅ Deployed 2026-09-20; migrations 017–018 applied (owner-reported) |
| Mobile responsiveness | ✅ Reviewed, one real defect fixed — not yet proven on a true 375px phone |
| Backups & restore | ✅ Done and rehearsed for real |
| Deployed to Vercel | ✅ Done (2026-09-10) |

Test suite at the end of 2026-09-20: 581 of 590 pass. Everything through Action 63 is pushed and deployed. The 9 failures are all admin session and auth tests broken by the unpushed multi-admin work (TASKS.md Action 69); Actions 55 and 58 (13 tests, passing) are committed inside that unpushed work.

---

## 3. What's left before launch

### 3a. Security — do this first (real exposure right now)
- [ ] **Do not push `main` as it stands.** Three local commits (`67cb04e`, `3cfa574`, `987bea3`) hold the multi-admin work (a fourth, `40a2d09`, is the separate guest-edit fix in Next Action 74 — earlier notes counted it here by mistake). It needs migrations 020-022 run by you (`npm run migrate`, from your own terminal) and new bride/groom login settings in Vercel **before** the push — pushed first, admin login and the guest and table lists break on the live site. Nine admin session tests also still fail against it. Decide how it ships (Next Action 69). Actions 55 and 58 shipped separately as PR #16 (merged and deployed 2026-09-21, `701cdc0`); local `main` must merge `origin/main` before it can be pushed, and pushing this chain is still your call.
- [x] **Reset the Neon database password** and update `DATABASE_URL` in `.env` and Vercel. *Done 2026-09-13 (Next Action 18a); the live database connection was re-confirmed working the same day.*
- [ ] Delete four already-merged GitHub branches by hand (Next Action 16): `claude/vibe-coding-checklist-markdown-h3cvo7`, `claude/mobile-admin-nav-fixes-h3cvo7`, `claude/deployment-runbook-h3cvo7` and `feature/ui-wrapping` — all four still exist on `origin` as of 2026-09-20. A fifth, `claude/session-start-markdown-28sxt0`, is undocumented and carries one stale docs-only commit (`6dec4b3`, 2026-09-13); merge, archive or delete is the owner's call. *(Owner-only — needs a browser.)*

### 3b. Needs the owner's real credentials to verify
These can't be tested without logging in for real:
- [x] Log in with a real invitation code, submit an RSVP, confirm it saves (proves the live database is really being used). *Owner confirmed 2026-09-13; a live test RSVP after the all-or-nothing-save deploy also worked on 2026-09-20 (owner-reported).*
- [x] Log in to `/admin` with the real password and confirm the real guest list appears. *Owner confirmed 2026-09-13.*
- [x] Open a WhatsApp reminder from `/admin/guests` and confirm the link starts with the real site address, not `localhost`. *Owner confirmed 2026-09-13.*
- [ ] Confirm the admin guest list or dashboard shows the 2026-09-20 test RSVP's status (accepted or declined, not pending) — the exact bug the all-or-nothing save fixed.
- [x] Try admin logout and guest logout on the live site (both changed 2026-09-18/19). *Owner replied "checked and confirmed" on 2026-09-20 to a list that included this — a general confirmation, not itemised.*
- [x] Look at the `reminder_2` template in `/admin/messages` and confirm it contains `[Code]` before the first real send. *Owner replied "checked and confirmed" on 2026-09-20 to a list that included this — a general confirmation, not itemised.*
- [ ] Action 50 (deployed): on a test party with two or more people (one of them seated, if you can), remove one person and confirm the list, the party's status, the headcount and the seat all update. Then try removing the last person and confirm you get a message instead of a removal.
- [ ] Action 56 (deployed): remove a test guest whose people are seated (the Remove on the guest's row) and confirm every one of their seats becomes open in the table window. Also unassign Napoleon's seat on Table 3 by hand — it was left behind before the fix.
- [ ] Action 57 (deployed): open Table Arrangement and confirm the names of removed guests (Pall, Sinesy and the colleagues family) are gone from the Accepted invitees list, and that Balance to Arrange no longer counts them. If Pall or Sinesy still show, send a screenshot of the list.
- [x] Action 59's seat rule: seating one person on an empty seat worked on the live site, and the two-tab refusal ("That seat already has someone on it.") was on the list of checks. *Owner replied "checked and confirmed" on 2026-09-20 to a list that included this — a general confirmation, not itemised.*
- [x] Action 63 on the live site: a seated person shows as "Name (Family or group name)", and the seat cards have no dietary or notes boxes or Save button. *Owner replied "checked and confirmed" on 2026-09-20 to a list that included this — a general confirmation, not itemised.*
- [x] Action 62 on the live site: edit a guest who has named people (change their WhatsApp number), reload, and confirm it stuck and Seats still matches the named people. *Owner replied "checked and confirmed" on 2026-09-20 to a list that included this — a general confirmation, not itemised.*
- [ ] **After Action 74 is deployed** (`40a2d09`, not pushed yet; if it is ever cherry-picked on its own it needs Action 67's rule (`701c6cc`) with it — see Next Action 74): on `/admin/guests`, edit a party that has named people, add two people under "Add more people to this party", press **Save changes** (not the small green button), and confirm the list shows the new Seats number and reopening the party shows the new names. This has only been proven against a stand-in database.
- [ ] **After Actions 55 and 58 are deployed:** have a test guest ask to add a person (from their invitation), then on `/admin/guests` press Approve and confirm the Seats number goes up by exactly one and the request disappears; press Approve again from a second tab and confirm you get "That request has already been handled." and Seats does not change. Then remove a test guest who has a pending request and confirm their request is no longer listed. This has only been proven against a stand-in database.

### 3c. Known bugs to fix
- [x] `/api/csrf` handed out a new token on every call instead of reusing a valid one *(fixed 2026-09-13, commit `9f38a0b`; confirmed against `app/api/csrf/route.ts` on 2026-09-20)* — this has already caused a real bug (two admin panels racing on the same page). Fix at the source instead of patching each symptom.
- [x] Add a `[Code]` placeholder to the `reminder_2` WhatsApp template before it's sent to anyone (guests need their code to get back in). *Written as migration 017; the owner reported running `npm run migrate` on 2026-09-20 — not independently verified. Worth a glance at the template in `/admin/messages` before the first real send.*
- [ ] People added to an existing party from the guest edit form were lost unless the small green "Add these people" button was used (Next Action 74). *Fixed and committed (`40a2d09`), click-tested on a stand-in database, no automated test, not pushed.*
- [ ] Decide what to do with 5 test guests still using the old code format (`SURNAME-NNN` instead of the current format) — they still work, but are inconsistent. Regenerate them or accept as-is.
*Items below marked done are deployed to production (`2d3cb2e` on 2026-09-20; the Vercel deploy was confirmed successful) — except the Action 62 fix, which is committed but not pushed. Apart from the RSVP save and the Action 62 fix (click-tested against a stand-in database, not the real one), none of the UI/route changes has been clicked through in a browser yet — see 3b.*
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
- [x] `message_logs.guest_id` has no `ON DELETE` clause, unlike the equivalent columns elsewhere (Next Action 40). *Migration 018 written 2026-09-17; the owner reported applying it on 2026-09-20 — not independently verified.*
- [x] A guest's RSVP was saved in separate steps, so a failure in the middle could tell the guest "saved" while the admin still saw "pending" (Next Action 49). *Done 2026-09-20 — now all-or-nothing; a live test RSVP worked (owner-reported).*
- [x] The admin's remove-one-person route had the same half-saved risk on the RSVP status it re-derives (Next Action 50). *Deployed 2026-09-20 (`22a2e6a`): the removal is now all-or-nothing, and removing the last person in a party is refused (use Remove on the guest's row). Not yet confirmed by a click-through — see 3b.*
- [x] Removing a whole guest left them, and their people, showing on their table seats (Next Action 56, found by the owner on the live site 2026-09-20). *Deployed 2026-09-20 (`b5f3910`); the owner reported it working. It does not fix seats already stuck from earlier removals — unassign those by hand in the table window.*
- [x] A removed guest's people stayed on the table window's "Balance to Arrange" list and count (Next Action 57, found by the owner 2026-09-20). *Deployed 2026-09-20 (`c7136ec`); the owner's re-check is pending. The report that people removed one at a time also stayed on the list did not reproduce — see TASKS.md.*
- [x] Pending "add another person" requests from a removed guest still showed for approval (Next Action 58, found 2026-09-20). *Fixed and click-tested 2026-09-20: they are hidden from the approval list and cannot be approved. Merged and deployed as PR #16 (`701cdc0`, 2026-09-21); still needs the live check.*
- [x] A seat could be silently taken over: a second person seated on an occupied seat quietly unseated the first (Next Action 59, Table Arrangement review 2026-09-20). *Code and tests done. **The repository change is already live** (swept into someone else's commit `fb86121`); its tests and the screen change were pushed afterwards (`fe44873`). Seating one person on an empty seat worked on the live real database (owner-reported 2026-09-20); the refusal itself is still to be checked in two tabs — see 3b.*
- [x] Old dietary notes could stay on a seat when the person changed (Next Action 60). *Superseded 2026-09-20 by Action 63: the owner asked for the dietary and notes boxes to be removed from the seat cards altogether, so there is nothing left to carry over.*
- [x] Seat cards show no dietary or notes boxes, and a seated person is shown as "Name (Family or group name)" so same-named people from different parties can be told apart (Next Action 63, owner request 2026-09-20). *Pushed (`f597a03`) and deployed; the owner confirmed the live check. The spreadsheet download still has its dietary and notes sections — the owner has not yet said whether it should change; see TASKS.md Action 63.*
- [ ] Remaining Table Arrangement review findings — mismatched units on the top cards, a seated person who later declines, the spreadsheet download, small items (Next Action 61).
- [x] Commit `9632cc7` (made outside this chat) stopped edits to a guest who has named people from saving, and added an endpoint that could zero legacy headcounts with no CSRF check (Next Action 62). *Fixed 2026-09-20: the edit now saves the other fields and the headcount in one step, and the unused endpoint is deleted — no mutating admin route is without a CSRF check now. Click-tested in a browser (a party renamed and given a new number, both saved), which the four fixes above did not get. **Not pushed or deployed yet — the breakage is still live until it is.** Migration 019 stays the owner's to run if headcounts drifted meanwhile.*
- [x] The admin's approve-request route approved the person and added one to the headcount as two separate writes (Next Action 55, found 2026-09-20). *Fixed and click-tested 2026-09-20: now all-or-nothing, and a request can no longer be approved twice (it used to add one to the headcount each time). Merged and deployed as PR #16 (`701cdc0`, 2026-09-21); still needs the live check — see the check in 3b.*

### 3d. Content & final polish
- [ ] Fill in real content: photos, Our Story timeline, final wording on all public pages (currently placeholder/test data in places).
- [ ] Confirm no horizontal scrolling or clipping on an actual phone at 375px width — checked so far by measuring, not by holding a real device.

### 3e. Process (lower urgency, doesn't block launch)
- [ ] The HITL safety-check script (`npm run hitl:migrate`) only covers database migrations today. Deploys, sending messages, secrets changes, and pushes to `main` are still unguarded by any automated check.
- [ ] CI runs only one check — the docs-consistency gate (`.github/workflows/docs-check.yml`). Tests, the build and lint are not run in CI, so a broken change could merge if nobody runs them by hand.
- [ ] UI/UX polish backlog, none of it launch-blocking: focus handling for the mobile menu (46), a Gallery enlarge-on-click (47 — needs a scope decision), and whether to keep the old Express prototype at all (48). (The skip-to-content link, Next Action 45, shipped 2026-09-20 and is live.)

---

## 4. Deliberately not building (out of scope for MVP)

- **Automatic WhatsApp/SMS/email sending** — decided against (no Twilio, cost). Admin always sends manually via a `wa.me` link.
- **Palette/font picker screen, invitation background image, custom CSS** — the palette and font choices are supported in the backend (`src/theme/palettes.js`) but no admin screen exists yet. The hero photo field *is* built (2026-09-12).
- **Event icon picker** — deferred. Venue photo upload *is* built (Vercel Blob); the event manager covers name/date/time/venue/address/photo.
- **A guest-written wishes wall with admin approval (PRD P1-05)** — decided 2026-09-13 (owner, in a Grill Me session): the Wishes section is a closing message with a "View Your Invitation" button instead.
- **P2 features:** nearby-hotels section, scheduled message campaigns, Sinhala language support. (The FAQ shipped on 2026-09-13 as a homepage section.)
- **Auto thank-you email (PRD P1-08)** — dropped 2026-09-20 (owner). Thank-yous stay on WhatsApp; see the after-launch list below.

**After launch (agreed 2026-09-20 — planned, not started, not part of the MVP):**
- Childhood photo carousels, Bride's and Groom's (PRD P1-02, Next Action 51).
- An admin show/hide switch for every area of the website, and a way to add new areas later (Next Action 52).
- A WhatsApp thank-you prompt for accepted RSVPs, plus more WhatsApp improvements still to be scoped (Next Action 53).
- The toast pop-up moved to the centre of the screen (Next Action 54).

---

## 5. Known differences from the original spec

Worth knowing so nobody "fixes" these by accident:
- Admin login is a single email + password stored in environment variables, not Supabase Auth as originally planned. There's no "forgot password" email flow because of this.
- Guest codes look like `CATEGORY-FIRSTNAME-random` (e.g. `FAMILY-NIMAL-x7k2`), not the original `SURNAME-NNN` format.
- Messaging is WhatsApp-only via manual links — no SMS, no automatic sending.
- Guests log in with their invitation code only — login-by-name was removed on 2026-09-16 because it leaked codes.
- The public site is one scrolling homepage; the old Our Story, Celebration, Gallery and Wishes URLs redirect to sections of it.

---

## 6. How to use this file

- Check items off as they're finished, and add anything new you find here.
- Once a section is fully checked off, move a short summary of it into `TASKS.md`'s history and delete it from here — this file should always read as "what's left," not a growing archive.
- Anything involving a deploy, migration, deleting data, secrets, or sending messages needs the exact HITL confirmation described in `HITL.md` — don't skip that step even for something that looks small.
