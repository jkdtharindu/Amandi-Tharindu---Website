# Plan: What to Do Before and After the Wedding

Written 2026-11-04 from a review session. Wedding day: **14 December 2026**. The site is live and real guests are using it, so the rule until then is: **no risky changes to guest pages.**

## Decision: split the invitation page AFTER the wedding

`app/(public)/invitation/[code]/InvitationClient.tsx` is about 900 lines. It holds the RSVP form, party members, table info, decline requests and add-to-calendar in one file. Splitting it into smaller files would make later changes easier and safer.

**Decided to wait until after 14 December, because:**
- It is the page every guest uses to RSVP and see their table.
- The automated tests do not cover this page's screen. A mistake in the move could pass all tests and the build.
- The dev server crashes on the owner's computer (Windows error `0xc0000142`), so the change cannot be seen working locally.
- The benefit is for future work, and little future work is planned.

**If it is ever done, do it this way:**
1. Move code only. No logic changes.
2. Small steps. Run tests, lint and `npm run build` after each one.
3. Do not push until the owner says so.
4. After the push, the owner checks on a phone with a test guest: log in, accept, decline, add a person, see the table line. If anything differs, run `git revert` straight away.
5. Split `app/(public)/page.tsx` (about 380 lines) the same way, last.

## Before the wedding (safe, small)
1. **Photo sizes for gallery and events.** Done and committed locally as `0f5594d`; **not pushed yet**. Owner decides when. Undo with `git revert 0f5594d`.
2. **Check rate limiting on the guest routes.** Login routes have it. Confirm the RSVP, "add a person" and "decline request" routes do too.
3. **Accessibility labels.** Only about 15 `aria-` labels exist across the app. Add the missing ones. Small fixes, tested before pushing.
4. **Watch real use.** Check the dashboard for new RSVPs, "add a person" requests and decline requests. If a guest reports a problem, note exactly what they saw.

## Nice to have (any time, low risk)
5. Add a type check (`tsc --noEmit`) to the automated checks.
6. One automated test for the guest RSVP flow.
7. A "preview as guest" button in admin.

## Already done
- Live click-through: owner did it. Checklist is in `docs/LIVE_CHECKLIST.md`.
- Hero photo now served resized. Live, owner confirmed it works.
- Darker hint text in the invitation code box. Live.
- Practice backup restore: done by the owner (2026-11-04).

## Dropped
- Updating `docs/ADMIN_USER_MANUAL.md` for decline requests: owner said let it go.
- Fixing the local dev server crash: only if it is needed.
