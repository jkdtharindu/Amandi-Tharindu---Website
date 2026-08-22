# Amandi & Tharindu — Project Tasks v3

## Project Status

- **Status:** Production Feature Enhancement & Public Release Preparation
- **Current Focus:** Supabase cloud deployment, RLS security policies, and final production verification.
- **Stack:** Next.js + TypeScript + Supabase + Vercel

---

## Task Execution Slices

### Phase 1 — Foundation & Next.js Setup

- [x] Configure Next.js App Router structure
- [x] Configure TypeScript and ESLint
- [x] Setup `.env.example` with Supabase keys
- [x] Create Supabase initial migration script (`schema.sql`) with all v3 tables:
  - `wedding_details`
  - `guests`
  - `rsvp_responses`
  - `wishes`

---

### Phase 2 — Chateau Green Aesthetic & Audio Engine

- [x] Implement Chateau Green color palette (`#2C3B30`, `#8BA888`, `#E8EFE9`, `#F4F6F0`)
- [x] Add oil-painting canvas frame overlays and botanical line art
- [x] Implement floating ambient audio sounding engine (Play / Pause / Mute)
- [x] Add multi-track ambient audio selection (Classical Piano, Acoustic Strings, Traditional Instrumental)
- [x] Implement live real-time countdown clock (Days, Hours, Minutes, Seconds)

---

### Phase 3 — Guest Authentication & Ambiguous Resolution

- [x] Implement invitation code lookup (`AT-2026-XXXX`)
- [x] Implement tokenized name normalization lookup
- [x] Implement ambiguous match candidate selection modal
- [x] Block soft-deleted guests from authenticating
- [x] Build secure guest session cookie handler (HTTP-only, Secure, SameSite, signed/encrypted)
- [x] Add server-side session validation on all protected routes
- [x] Implement rate limiting on login endpoints

---

### Phase 4 — Personalized Invitation & Interactive Wax Seal

- [x] Implement interactive digital wax seal animation (open/unfold on interaction)
- [x] Display personalized guest name, assigned seat quota, and invitation code
- [x] Display venue, ballroom/hall, ceremony times, reception time, and dress code
- [x] Implement sticky RSVP reminder bar for pending guests (disappears on response)

---

### Phase 5 — Detailed RSVP Experience

- [x] Implement attendance status selection (Joyfully Accept / Regretfully Decline)
- [x] Implement seat count picker bound to per-guest quota (`allowed_guest_count`)
- [x] Implement individual attendee name input fields (one per seat selected)
- [x] Implement dietary requirements capture per attendee
- [x] Implement optional personal message to couple
- [x] Enable RSVP modification for returning guests (update latest response)
- [x] Display confirmation screen after submission

---

### Phase 6 — Public Site Features

- [x] Our Story milestone timeline cards with botanical borders
- [x] Celebration page with Poruwa Ceremony & Reception schedules
- [x] Add interactive Google Maps venue direction link
- [x] Gallery lightbox for oil-painting photography
- [x] Wishes wall submission & public feed
- [x] Shared layout/wrapper across all public pages
- [x] Wishes moderation flag (`is_approved`) supported in data model

---

### Phase 7 — Admin Control Panel & Customizers

- [x] Admin login authentication gate
- [x] Dashboard overview metric cards (Total Invited, Confirmed Headcount, Awaiting, Declined)
- [x] Guest Roster Manager (Search, Add, Edit, Soft-Delete/Reactivate, view dietary notes)
- [x] RSVP viewer (filter by status, search guests, see attendance totals, latest state)
- [x] Live Theme & Style Customizer (5 color palettes, 4 font families)
- [x] Hero Image Uploader & Gallery Image Manager
- [x] Event & Venue Content Editor (venue, ballroom, address, Maps link, times, dress code, audio URL)
- [x] Wedding Date/Time picker (auto-syncs live homepage countdown clock)

---

### Phase 8 — Supabase Integration & Deployment

- [ ] Execute `schema.sql` migration on Supabase Cloud (all tables: `wedding_details`, `guests`, `rsvp_responses`, `wishes`)
- [ ] Configure Row Level Security (RLS) policies on all Supabase tables
  - [ ] `guests`: Admin full access; guests read own record only
  - [ ] `rsvp_responses`: Admin full access; guests read/write own record only
  - [ ] `wedding_details`: Admin full access; public read-only
  - [ ] `wishes`: Public insert; admin read/approve/delete
- [ ] Connect Next.js data-access layer to Supabase via environment variables
- [ ] Perform security review:
  - [ ] Verify RLS blocks guest roster enumeration
  - [ ] Verify cross-guest data isolation
  - [ ] Verify admin routes are protected from guest sessions
  - [ ] Validate all user inputs server-side
  - [ ] Review guest privacy and data exposure
- [ ] Test Interactive Wax Seal & Detailed Dietary RSVP end-to-end
- [ ] Verify Google Maps link & Venue Content in Admin
- [ ] Test Ambient Audio Sounding Engine
- [ ] Verify production build on Vercel (no build errors)
- [ ] Complete HITL deployment check per `HITL.md`
- [ ] Launch live application to public

---

## Priority Order for Completion

```
Execute Supabase Schema Migration (all 4 tables)
↓
Configure RLS Policies
↓
Wire Next.js Data-Access Layer to Supabase
↓
Security Review & RLS Verification
↓
Test Interactive Wax Seal & Dietary RSVP
↓
Verify Google Maps Link & Venue Content in Admin
↓
Test Ambient Audio Sounding Engine
↓
Final Vercel Production Deployment (requires HITL approval)
```

---

## Test Checklist (must pass before launch)

| Test | Status |
|---|---|
| Valid invitation code login → session created | ⬜ |
| Invalid invitation code → no session, friendly error | ⬜ |
| Soft-deleted guest → blocked from login | ⬜ |
| Name login, single match → session created | ⬜ |
| Name login, multiple matches → resolution modal shown | ⬜ |
| Authenticated guest sees personalized invitation | ⬜ |
| Wax seal animation triggers invitation reveal | ⬜ |
| Full RSVP submission (names + dietary) persists to Supabase | ⬜ |
| Guest can return and modify existing RSVP | ⬜ |
| Sticky reminder disappears after RSVP submitted | ⬜ |
| Admin login gate blocks unauthenticated access | ⬜ |
| Admin dashboard metrics are accurate | ⬜ |
| Admin can add, edit, soft-delete, and reactivate guests | ⬜ |
| Admin can filter and search RSVPs | ⬜ |
| Theme customizer changes reflect on public site | ⬜ |
| Countdown clock updates in real time | ⬜ |
| Audio engine plays, pauses, and switches tracks | ⬜ |
| Gallery lightbox works on mobile | ⬜ |
| Wishes wall submission saves and displays correctly | ⬜ |
| RLS: guests cannot access other guests' data | ⬜ |
| Mobile responsiveness on all public and guest pages | ⬜ |
