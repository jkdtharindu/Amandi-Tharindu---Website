# Shared State: Admin ↔ Guest Data Flow

This describes how data moves between the **Admin portal** (`app/admin/**`) and the **Guest portal** (`app/(public)/**`) in this wedding RSVP app. Both portals read and write the same underlying data, but they are two separate apps glued together by a shared database — there is no live push channel between them today. Every "sync" described below is either a server round-trip on next page load, or an explicit cache-refresh call.

Plain-language summary before the details: **the admin makes a change, the database is updated immediately, and the guest side picks it up the next time it loads a page** — either because that page always re-checks the database (most guest pages), or because the admin's save explicitly told Next.js to throw away its cached copy of a few specific pages (the 5 static ones). There are no WebSockets, no polling, and no "live" badge that updates itself without a reload.

---

## 1. Global Data Entities

All entities live in Postgres (Neon, in production) and are mirrored table-for-table by an in-memory fallback used only when `DATABASE_URL` is unset (local dev without a database). Field names below are the JS/API shape (camelCase); the SQL columns are snake_case equivalents.

### Guest
One invitation / one party. The root entity everything else hangs off.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `code` | string | unique invite code, e.g. `SILVA-001` |
| `name` | string | party/household name |
| `relationship` | string | e.g. Family, Friend, Colleague |
| `slotCount` | number | how many seats this party gets |
| `whatsappNumber` | string \| null | |
| `email` | string \| null | |
| `hasVisited` | boolean | has this code been used to log in |
| `rsvpStatus` | `'pending' \| 'accepted' \| 'declined'` | see derivation rule below |
| `isDeleted` | boolean | soft-delete flag, never hard-deleted |
| `createdAt` | timestamp | |

### Invitee
One named person inside a Guest's party. Lets a multi-seat invitation track each person's own RSVP instead of one status for the whole party.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `guestId` | uuid | FK → Guest, cascade-deletes with the guest |
| `name` | string | |
| `rsvpStatus` | `'pending' \| 'accepted' \| 'declined'` | this person's own answer |
| `addedBy` | `'admin' \| 'guest'` | admin-entered names are pre-approved; guest-added names need approval |
| `approvalStatus` | `'approved' \| 'pending_approval' \| 'rejected'` | |
| `displayOrder` | number | |
| `createdAt`, `updatedAt` | timestamp | |

**Derived rule** (not stored, computed on every read — `deriveGuestRsvpStatus` in [src/invitees/inviteesRepo.js:35](src/invitees/inviteesRepo.js:35)): a Guest's `rsvpStatus` becomes `accepted` the moment *any one* approved Invitee accepts (so they can be seated right away), `declined` only once *every* approved Invitee has declined, and `pending` otherwise. `pending_approval` invitees are excluded from this calculation entirely.

### RsvpResponse
A legacy, whole-party mirror of the RSVP, kept in sync alongside the per-Invitee data so existing readers (CSV export, dashboard stats) keep working unchanged.

| Field | Type |
|---|---|
| `id` | uuid |
| `guestId` | uuid, FK → Guest |
| `attending` | boolean |
| `participantNames` | string[] |
| `submittedAt`, `updatedAt` | timestamp |

### ThemeSettings, SiteSection, CelebrationEvent
Content the admin edits and the guest site renders: palette/fonts/couple names/date/venue (single row), page sections (About, Gallery, etc.), and celebration events (ceremony, reception — name, date, time, venue, image). These are the entities behind the "instant" sync problem in Section 2, because the pages that render them are pre-built (static), not re-checked per request.

### SeatingTable / TableSeat / ProbableAttendee
Table planning: a `TableSeat` holds **at most one** occupant — a real Guest, an individual Invitee, or an anonymous `ProbableAttendee` placeholder (a seat held for an expected-but-unconfirmed party) — enforced by a database constraint, never by application logic alone.

### MessageTemplate / MessageLog
WhatsApp/message templates (invite, reminders, thank-you) and a log of what was sent to which guest, when, and whether it succeeded.

---

## 2. State Synchronization Rules

There is **no real-time channel** (no WebSockets, no Server-Sent Events, no polling) anywhere in this app. "Sync" happens one of three ways, depending on which kind of page is involved:

**A. Guest-facing dynamic pages (the common case) — always fresh, nothing to invalidate.**
Pages like the guest's own `/invitation/[code]` view are rendered fresh on every request (`force-dynamic`, or forced dynamic by reading cookies for the session). An admin edit to that guest's RSVP status, seat, or invitee list is visible to the guest the instant they load or reload that page. No cache exists here to go stale.

**B. The static public pages — cached, and explicitly busted on save.**
Home (which now includes the Our Story and Event Details sections, folded in during Phase 6), Gallery, and Wishes are pre-rendered as static HTML for speed. If the admin changes the theme, a page section, or a celebration event, that change would otherwise only reach guests on the next full deploy. To avoid that, every admin save to Theme, Sections, or Events explicitly calls `revalidateAllPublicPages()` ([src/revalidatePublicPages.js](src/revalidatePublicPages.js)), which tells Next.js to throw away and regenerate the cached HTML for those 3 specific paths (`/`, `/gallery`, `/wishes`). The next guest to load any of those pages gets the new content; anyone with the page already open in their browser needs to reload. `/our-story` and `/the-celebration` are now just redirects to anchors on `/` (`next.config.ts`), so revalidating `/` covers both.

  A known quirk, documented in code: this only works with literal per-page calls (`revalidatePath('/gallery')`); the broader "revalidate the whole layout" form was tested and found *not* to regenerate the on-disk static file under this project's production build, so don't switch to it without re-verifying.

**C. Inside the Admin portal itself — no live sync between two admins, no optimistic updates.**
If two admins have the guest list open at once, one admin's edit does **not** appear for the other automatically — there is no push and no polling. Each admin's own screen only refreches after **their own** mutation: every add/edit/delete/approve/reject re-fetches the full list from the server (`load()`) rather than patching the local list in place. So the source of truth after any write is always a fresh server round-trip, never a locally-guessed update — this avoids the UI ever showing a value that doesn't match the database, at the cost of one extra request per action.

**Why an in-memory dev store shows this correctly but felt broken before:** in local dev without a database, data lives in a `globalThis`-backed in-memory array per entity (e.g. `guestStore`), not Postgres. Turbopack's dev bundler was previously instantiating each store module *twice* — once for Route Handlers, once for Server Components — so a write through one path was invisible to a read through the other, which looked like a sync bug but wasn't one. That's fixed (see [MEMORY.md](MEMORY.md), 2026-09-12 entry) and only ever affected the no-database dev mode — production always runs against real Postgres, where this class of bug can't occur (`query()` opens a real connection per call, no module-level cache to duplicate).

---

## 3. API & Event Triggers

Every mutation is a plain REST call (GET/POST/PATCH/DELETE) guarded by CSRF token + session cookie. There are no background jobs or event queues — each row below is a direct request/response.

| Trigger | Route | What it updates | Also busts static cache? |
|---|---|---|---|
| Admin creates/edits/deletes a guest | `POST` / `PATCH` / `DELETE` `/api/admin/guests[/id]` | `guests` (delete is soft: `isDeleted = true`) | No |
| Admin removes one invitee from a party | `DELETE /api/admin/guests/[id]/invitees/[inviteeId]` | Deletes the `Invitee`, frees their seat, re-derives the party's `rsvpStatus` and `slotCount` | No |
| Guest submits their RSVP | `POST /api/guest/rsvp` | `rsvp_responses` upsert, `guests.rsvp_status`, and (if the party has named Invitees) each Invitee's own `rsvpStatus` | No |
| Guest asks to add another person | `POST /api/guest/invitees/request` | New `Invitee` row, `approvalStatus: 'pending_approval'` | No |
| Admin approves/rejects a pending invitee request | `POST /api/admin/invitee-requests/[id]/approve` \| `reject` | Approve sets `approvalStatus: 'approved'` and increments the guest's `slotCount`; reject sets `'rejected'` | No |
| Admin edits theme (colors, fonts, couple info) | `PUT /api/admin/theme` | `theme_settings` (single row) | **Yes** |
| Admin edits a page section | `POST` / `PATCH` / `DELETE` `/api/admin/sections[/id]` | `site_sections` | **Yes** |
| Admin edits a celebration event | `POST` / `PATCH` / `DELETE` `/api/admin/events[/id]` | `celebration_events` | **Yes** |
| Admin assigns/unassigns a seat | `POST /api/admin/table-arrangement/[tableId]/seats/[seatId]/assign` \| `unassign` | `table_seats` | No |
| Admin logs a sent message | `POST /api/admin/messages/log` | `message_logs` | No |

**CSRF, on every mutation above:** the client first `GET`s `/api/csrf` to get a token, then sends it back as an `x-csrf-token` header, which the server checks against a matching cookie (double-submit pattern). As of this session's fix, `/api/csrf` reuses a still-valid cookie instead of minting a new one on every call — the old behavior (always issuing a fresh token) meant two admin components fetching it on the same page could invalidate each other's token and cause a real "Invalid CSRF token" failure on Approve/Reject. `admin/logout` and `guest/logout` currently skip the CSRF check entirely — a known, tracked gap, not by design.

---

## 4. Local vs. Global State Boundaries

**Local (component `useState`, never sent to the server until the user acts):**
- Filter/search UI: status filter, relationship filter, search text
- Form drafts: the add/edit guest form, including invitee names being typed
- UI-only flags: which modal is open, which row is "busy" mid-request, inline validation errors, toast/message banners
- The mount-time CSRF token itself (cached locally, reused for all mutations on that page load)

**Global (server is the source of truth; local state is only ever a snapshot of the last server read):**
- The guest list, invitee list, theme settings, sections, events, seating layout — anything in Section 1
- After every mutation, the admin UI **re-fetches from the server** rather than patching its local copy — so what you see always matches what was just written to the database, one request later
- A guest's own RSVP state is never cached client-side across visits in a way that matters — the page that shows it is server-rendered fresh on each load

**Rule of thumb for new features:** if two different windows (two admin tabs, or an admin tab and a guest page) both need to see the same fact, it belongs in the database, not component state — and if that fact is rendered by one of the 5 static public pages, the write path must also call `revalidateAllPublicPages()` or guests won't see it until the next deploy.
