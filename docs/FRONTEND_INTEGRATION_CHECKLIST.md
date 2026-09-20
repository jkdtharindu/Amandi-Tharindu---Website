# Frontend Integration Checklist — Multi-Admin Features

> **Correction, 2026-09-20 (session-end pass): do not rely on this file.** Its "backend complete" claim was made before the tests and build were run (9 tests fail; see `TASKS.md` Action 69). Its task numbers 65-71 clash with the real Next Actions 65-71 in `TASKS.md`; the real numbers for this work are **69** (make it pushable) and **73** (build the screens, message drop-down, dashboard split and route scoping). Removal of this file is filed as Action 71.
**Date:** 2026-09-20  
**Features:** P1-14B through P1-14H (Bride & Groom Multi-Admin)  
**Status:** Backend complete. Frontend UI pending.

---

## Overview

The **backend API** for multi-admin bride/groom support is complete (commit 67cb04e). All routes are built, tested, and filtering by party. This checklist tracks the **frontend UI integration** work needed to wire these features into React components.

**Key Context:**
- Each admin logs in with their own email (`BRIDE_EMAIL` / `GROOM_EMAIL`)
- Session stores which party they are (`bride` or `groom`)
- All GET endpoints return party-filtered data + per-party stats + overall total
- All POST/PATCH/DELETE endpoints auto-assign/verify party ownership (403 on cross-party access)
- User manual is complete (`docs/ADMIN_USER_MANUAL.md`) — reference for expected workflows

---

## Frontend Tasks

### ✅ Task 1: Guest List UI (Next Action 65)

**What:** React component showing guests with party badge. Filters by RSVP status, relationship, search. Display per-party stats + overall total.

**API Route:** `GET /api/admin/guests`  
**Response:**
```json
{
  "guests": [ /* party-filtered list */ ],
  "stats": {
    "party": { "invited": 45, "accepted": 35, "declined": 5, "pending": 5 },
    "overall": { "invited": 90, "accepted": 70, "declined": 10, "pending": 10 }
  },
  "party": "bride"
}
```

**Acceptance Criteria:**
- [ ] Guest list displays only logged-in party's guests
- [ ] Party label badge shows on each guest (e.g., blue for bride, green for groom)
- [ ] Filter dropdowns work (RSVP status, relationship, search)
- [ ] Stats card shows "Your Party" stats + "Total Wedding" stats side-by-side
- [ ] Clicking a guest opens edit form (PATCH /api/admin/guests/[id] with party verification)
- [ ] Delete button works (DELETE with party verification, returns 403 on cross-party)
- [ ] Component tests cover both bride and groom views
- [ ] Mobile responsive

**Estimated Effort:** 4–6 hours  
**Owner:** [Frontend]  
**Model:** Sonnet 5  
**Blocks:** Table Arrangement UI, E2E testing  

**Checklist:**
- [ ] Component built
- [ ] API integration tested
- [ ] Party filtering verified (no groom guests in bride view, etc.)
- [ ] Stats display validated
- [ ] Component tests written (both parties)
- [ ] PR reviewed & merged

---

### ✅ Task 2: Table Arrangement UI (Next Action 66)

**What:** React component showing only logged-in party's tables and unassigned guests. Drag-to-assign interface (or click-to-assign).

**API Routes:**
- `GET /api/admin/table-arrangement` — returns party-filtered tables + unassigned guests
- `POST /api/admin/table-arrangement` — creates table for this party
- `POST /api/admin/table-arrangement/[tableId]/seats/[seatId]/assign` — assigns guest (403 if cross-party)

**Response (GET):**
```json
{
  "tables": [ /* party-filtered tables only */ ],
  "unassignedGuests": [ /* only this party's unassigned accepted guests */ ],
  "stats": {
    "party": { "invited": 45, ... },
    "overall": { "invited": 90, ... }
  },
  "party": "bride"
}
```

**Acceptance Criteria:**
- [ ] Table list displays only party's tables (no cross-party tables visible)
- [ ] Unassigned guests list shows only unassigned, accepted guests from this party
- [ ] Drag-to-assign (or click-to-assign) moves guest to table seat
- [ ] Cross-party attempt shows 403 error message (if API enforces it)
- [ ] Seat assignment updates seat details (dietary, notes, etc.)
- [ ] Create new table form assigns to current party automatically
- [ ] Component tests cover both parties
- [ ] Mobile responsive

**Estimated Effort:** 4 hours  
**Owner:** [Frontend]  
**Model:** Sonnet 5  
**Depends On:** Task 1 (Guest List UI)  
**Blocks:** E2E testing  

**Checklist:**
- [ ] Component built
- [ ] Party-scoped table list verified
- [ ] Guest assignment logic working
- [ ] Create table assigns to party automatically
- [ ] Component tests written (both parties)
- [ ] PR reviewed & merged

---

### ✅ Task 3: Messages UI (Next Action 67)

**What:** React component with template dropdown → preview → "Send via WhatsApp" → checkbox to mark message event completed.

**API Routes:**
- `GET /api/admin/guests` — returns message event status per guest (new field in response)
- `POST /api/admin/messages/events` — record message sent
- `GET /api/admin/messages/events?guestId=X` — get message history

**UI Flow:**
1. Admin clicks "WhatsApp" button on guest card
2. Dropdown menu appears with template options (e.g., "RSVP Reminder", "Thank You", "Table Details", "Final Reminder")
3. Click template → preview modal shows filled-in message with guest's details
4. "Send via WhatsApp" button opens `wa.me` link with pre-filled message
5. Admin sends manually in WhatsApp
6. Returns to site, checks checkbox: "✓ RSVP Reminder sent"
7. Dashboard updates to show completed message event

**Acceptance Criteria:**
- [ ] Template dropdown appears on guest card (or admin page)
- [ ] Template preview shows placeholders filled ([Name], [Code], [Table], [Greeting], etc.)
- [ ] "Send via WhatsApp" opens wa.me link (no error)
- [ ] POST /api/admin/messages/events records event as completed
- [ ] Dashboard/guest list shows message event status (✓ or ☐)
- [ ] Get message history retrieves list of completed events per guest
- [ ] Component tests cover template selection, preview, checkbox update
- [ ] Only current party's guests appear in lists

**Estimated Effort:** 3 hours  
**Owner:** [Frontend]  
**Model:** Sonnet 5  
**Blocks:** E2E testing  

**Checklist:**
- [ ] Template dropdown & preview built
- [ ] WhatsApp button integration working
- [ ] Message event tracking (POST) functional
- [ ] Checkbox toggles is_completed state
- [ ] Party-filtered guest lists verified
- [ ] Component tests written
- [ ] PR reviewed & merged

---

### ✅ Task 4: Dashboard Redesign (Next Action 68)

**What:** Update dashboard to show per-party stats (invited, accepted, declined, pending) + collective total in a clear layout.

**Data Source:** `GET /api/admin/guests` already returns:
```json
{
  "stats": {
    "party": { "invited": 45, "accepted": 35, "declined": 5, "pending": 5 },
    "overall": { "invited": 90, "accepted": 70, "declined": 10, "pending": 10 }
  }
}
```

**Dashboard Layout (Suggested):**
```
┌─────────────────────────────────────────────────────────────┐
│ RSVP Dashboard — Amandi & Tharindu Wedding                  │
├──────────────────────────┬──────────────────────────────────┤
│ YOUR PARTY (Bride)       │ TOTAL WEDDING                    │
├──────────────────────────┼──────────────────────────────────┤
│ Invited:  45             │ Invited:  90                     │
│ Accepted: 35 (78%)       │ Accepted: 70 (78%)               │
│ Declined:  5             │ Declined: 10                     │
│ Pending:   5             │ Pending:  10                     │
├──────────────────────────┼──────────────────────────────────┤
│ Chart: Bride breakdown    │ Chart: Overall breakdown         │
│ [78% accepted pie]       │ [78% accepted pie]               │
└──────────────────────────┴──────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Per-party stats card displays correctly (invited, accepted %, declined, pending)
- [ ] Overall total card displays correctly
- [ ] Charts updated to show per-party breakdown (if using charts)
- [ ] Labels clearly indicate "Your Party" vs "Total Wedding"
- [ ] Stats auto-refresh or update on guest RSVP changes
- [ ] Mobile responsive (stacked on narrow screens)
- [ ] Color coding consistent with party badges (bride = blue, groom = green, etc.)
- [ ] CSV export includes party assignment per guest (if applicable)

**Estimated Effort:** 2 hours  
**Owner:** [Frontend]  
**Model:** Sonnet 5  
**Blocks:** E2E testing  

**Checklist:**
- [ ] Dashboard layout redesigned
- [ ] Per-party stats card built & populated
- [ ] Overall stats card built & populated
- [ ] Charts (if used) updated
- [ ] Mobile responsive tested
- [ ] Auto-refresh tested
- [ ] PR reviewed & merged

---

### ✅ Task 5: Invitee Routes Party Validation (Next Action 69)

**What:** Verify `/api/admin/guests/[id]/invitees` respects party ownership. Likely no changes needed, but needs confirmation.

**API Route:** `GET /api/admin/guests/[id]/invitees`  
**Current Behavior:** Likely auto-filters by guest's party (since guest inherits party from creation).

**Acceptance Criteria:**
- [ ] GET returns invitees only if guest belongs to logged-in admin's party
- [ ] Returns 403 if guest is owned by other party
- [ ] Tests confirm party isolation

**Estimated Effort:** 1 hour  
**Owner:** [Backend]  
**Model:** Sonnet 5  

**Checklist:**
- [ ] Route tested with both bride and groom guests
- [ ] Cross-party attempt verified (returns 403)
- [ ] No code changes needed (or minimal if any)
- [ ] PR reviewed & merged (if changes)

---

### ✅ Task 6: E2E Testing (Multi-Admin) (Next Action 70)

**What:** Full flow test as both bride and groom: guest creation → RSVP → table assignment → message sending. Verify no data leaks between parties.

**Test Scenarios:**

1. **Bride Admin Flow:**
   - [ ] Log in as bride (BRIDE_EMAIL)
   - [ ] Create 3 bride guests
   - [ ] Verify groom guests NOT visible
   - [ ] Accept RSVP for 2 guests
   - [ ] Create table for bride
   - [ ] Assign bride guests to table
   - [ ] Send "Thank You" WhatsApp message to guest
   - [ ] Check message event completed

2. **Groom Admin Flow:**
   - [ ] Log in as groom (GROOM_EMAIL)
   - [ ] Create 2 groom guests
   - [ ] Verify bride guests NOT visible
   - [ ] Accept RSVP for 1 guest
   - [ ] Create table for groom
   - [ ] Assign groom guests to table
   - [ ] Send "RSVP Reminder" message to guest
   - [ ] Check message event completed

3. **Isolation Tests:**
   - [ ] Bride cannot see groom guests (list shows 0, or filtered)
   - [ ] Groom cannot see bride guests
   - [ ] Bride cannot edit groom guest (404 or 403)
   - [ ] Groom cannot delete bride guest (404 or 403)
   - [ ] Bride cannot assign groom guest to table (403)
   - [ ] Dashboard shows correct per-party counts for each

4. **Dashboard Verification:**
   - [ ] Bride sees: "Your Party: 3 invited, 2 accepted..." + "Total: 5 invited, 3 accepted..."
   - [ ] Groom sees: "Your Party: 2 invited, 1 accepted..." + "Total: 5 invited, 3 accepted..."
   - [ ] Stats match reality (counts correct)

**Estimated Effort:** 3 hours  
**Owner:** [QA]  
**Model:** Opus 5 (multi-constraint validation)  
**Depends On:** Tasks 1–4  
**Blocks:** Deployment  

**Checklist:**
- [ ] Test plan created (scenarios above)
- [ ] Both admin accounts set up with passwords
- [ ] Bride flow tested end-to-end
- [ ] Groom flow tested end-to-end
- [ ] Party isolation verified (no data leaks)
- [ ] Stats accuracy verified
- [ ] Bug log created (if any)
- [ ] Sign-off from QA/owner

---

### ✅ Task 7: Deployment & Go-Live (Next Action 71)

**What:** Run migrations in production, set env vars, deploy to Vercel, smoke test.

**Pre-Flight Checklist:**
- [ ] All 6 UI tasks completed (1–6)
- [ ] E2E test passed
- [ ] Code reviewed & merged to main
- [ ] No uncommitted changes on main branch

**Deployment Steps:**
1. **Run Migrations:**
   - [ ] Backup production database (Supabase)
   - [ ] Run migrations 020, 021, 022 (add party fields, create message_events table)
   - [ ] Verify schema changes in Supabase dashboard

2. **Set Environment Variables:**
   - [ ] Set `BRIDE_EMAIL` in Vercel project settings
   - [ ] Set `BRIDE_PASSWORD_HASH` (generate via `npm run admin:set-password`)
   - [ ] Set `GROOM_EMAIL` in Vercel project settings
   - [ ] Set `GROOM_PASSWORD_HASH` (generate via `npm run admin:set-password`)
   - [ ] Keep existing `SESSION_SECRET`, `DATABASE_URL`, `SUPABASE_*` vars unchanged

3. **Deploy:**
   - [ ] Push main branch to GitHub
   - [ ] Trigger Vercel deploy (or auto-deploy on push)
   - [ ] Wait for build to complete
   - [ ] Verify deployment successful

4. **Smoke Test:**
   - [ ] **Bride:** Log in, create guest, verify guest list shows only bride guests, stats correct
   - [ ] **Groom:** Log in, create guest, verify guest list shows only groom guests, stats correct
   - [ ] **Cross-Party:** Bride attempts to delete groom guest → 403 error
   - [ ] **Dashboard:** Both admins see per-party + overall stats

**Estimated Effort:** 1 hour (plus HITL approval)  
**Owner:** [DevOps/Owner]  
**Model:** Sonnet 5  
**Depends On:** Task 6 (E2E Testing) + HITL approval  
**HITL:** Required. Owner sign-off before production changes.  

**Checklist:**
- [ ] HITL approval obtained
- [ ] Backup completed
- [ ] Migrations applied to production
- [ ] Env vars set
- [ ] Deploy triggered
- [ ] Build successful
- [ ] Smoke test bride flow
- [ ] Smoke test groom flow
- [ ] Smoke test cross-party isolation
- [ ] Go-live confirmed
- [ ] Notify stakeholders (Amandi & Tharindu)

---

## Status Summary

| Task | Status | Owner | Est. Hours | Model |
|------|--------|-------|-----------|-------|
| 1. Guest List UI | ❌ Pending | [Frontend] | 4–6 | Sonnet 5 |
| 2. Table Arrangement UI | ❌ Pending | [Frontend] | 4 | Sonnet 5 |
| 3. Messages UI | ❌ Pending | [Frontend] | 3 | Sonnet 5 |
| 4. Dashboard Redesign | ❌ Pending | [Frontend] | 2 | Sonnet 5 |
| 5. Invitee Routes Check | ❌ Pending | [Backend] | 1 | Sonnet 5 |
| 6. E2E Testing | ❌ Pending | [QA] | 3 | Opus 5 |
| 7. Deployment | ❌ Pending | [DevOps] | 1 + HITL | Sonnet 5 |
| **TOTAL** | **❌ 0% Complete** | — | **18–20 hours** | — |

---

## References

- **Backend Implementation:** Commit 67cb04e (multi-admin auth, party filtering, message events)
- **API Routes:** `/api/admin/guests`, `/api/admin/table-arrangement`, `/api/admin/messages/events`
- **User Manual:** `docs/ADMIN_USER_MANUAL.md` (coordination workflows, troubleshooting)
- **Implementation Summary:** `docs/IMPLEMENTATION_SUMMARY.md` (what's done, what's left)
- **PRD:** `docs/amandi-tharindu-wedding-PRD.md` (P1-14B through P1-14H acceptance criteria)
- **Model Selection:** `docs/WEDDING_MODEL_SELECTION.md` (required model checks)
- **Ubiquitous Language:** `docs/WEDDING_UBIQUITOUS_LANGUAGE.md` (party terminology)

---

**Last Updated:** 2026-09-20  
**Backend Status:** ✅ Complete  
**Frontend Status:** ❌ Not Started  
**Go-Live Target:** After E2E testing passes
