# Product Requirements Document
## Amandi & Tharindu Wedding Website

---

> **FOR AI AGENTS:** This document is self-contained. Read it fully before writing any code.
> No additional explanation will be provided. All decisions, constraints, and acceptance criteria are defined below.
> Stack: Next.js 14 (App Router) · Supabase · Vercel · Twilio · Resend
> Deadline: 35 days from project start. Wedding date: Monday, 14 December 2026.

---

## Project Overview

**Project Name:** Amandi & Tharindu Wedding Website

**What it does:** A guest-facing wedding website for Amandi Wijesundara and Tharindu Jayanetti's wedding on Monday, 14 December 2026. Guests access a personalized digital invitation using a unique code printed on their physical wedding card, RSVP with participant details, and explore wedding information. The couple's admin (groom/bride) manages the entire guest list, messaging, content, and theme through a private admin panel.

**Target Users:**
- **Primary:** ~350 family-unit guests receiving physical wedding cards with unique access codes
- **Secondary:** The couple (Amandi & Tharindu) as admins managing the site content, guest list, and communications

**Core Problem it Solves:** Eliminates the logistical chaos of manually tracking RSVPs for a 350-family-unit wedding. Replaces WhatsApp group chaos and spreadsheet tracking with a structured, automated system where guests self-serve their RSVP, the couple sees real-time headcounts, and automated reminders are sent to non-responders via WhatsApp/SMS/email.

---

## 1. Problem Statement

Managing RSVPs for a 350-family-unit wedding in Sri Lanka involves:
- No central tracking of who has confirmed attendance
- Manual follow-up via phone/WhatsApp for non-responders
- No accurate headcount for catering and venue planning
- Physical invitation cards give no feedback loop to the couple
- No way to notify guests of last-minute changes (venue, time, etc.)

This website solves all of the above with a personalized, code-gated RSVP system backed by a full admin dashboard and messaging center.

---

## 2. Goals & Success Metrics

### Goals
- Launch the website within 35 days
- Enable all 350 family units to RSVP digitally
- Give the admin couple full control over content, theme, and guest communication with no developer dependency after launch

### Success Metrics
| Metric | Target |
|---|---|
| RSVP response rate | ≥ 80% of invited family units before wedding day |
| Admin messaging delivery rate | ≥ 95% of sent WhatsApp/SMS messages delivered |
| Site uptime during peak RSVP period | 99.9% |
| Time for admin to add a new guest | < 2 minutes |
| Mobile usability | Full functionality on mobile browsers (iOS & Android) |
| Zero developer dependency post-launch | All content editable via admin panel |

---

## 3. User Personas

## Prototype Implementation Status

The project currently includes a runnable Express-based prototype used for early integration and UI validation. Public pages (Home, Our Story, Celebration, Gallery, Wishes) and the guest login flow (code + name, ambiguous name resolution) are implemented in the prototype for local testing. Key prototype notes:

- The public pages use a shared `pageWrapper` with a refreshed wedding-themed layout and responsive styles.
- Guest login by code/name, session cookie creation, CSRF protection, and basic RSVP persistence helpers are present in `src/` for local verification.
- **Admin panel (Theme Editor + Section Manager) is implemented in the prototype** at `/admin` (login), `/admin/theme`, and `/admin/sections`, matching P0-09, P1-10, and P1-11 below with two prototype-scoped adjustments (see note under P1-10 and P1-11): single seeded admin account via env vars instead of Supabase Auth, and image fields (hero image, invitation template) accept a URL string rather than a direct file upload, since Supabase Storage is not yet wired up. Guest management (P0-07), the RSVP dashboard (P0-08), and messaging (P1-06/07/08) remain unimplemented.
- Supabase DB integration, messaging (Twilio/Resend), and production deploys remain in the PRD scope and are P0/P1 items to fully implement.

Use the prototype for local validation and UI polish; follow `HITL.md` for any actions that could affect production or guest data.

### Persona 1: The Wedding Guest (Nimal Silva, 45)
- Received a physical wedding card with a unique code (e.g., `SILVA-001`)
- Not very tech-savvy; uses a smartphone (Android, Sri Lanka)
- Visits the website by typing the URL from the card
- Enters his family's code or name, sees a beautiful personalized invitation
- RSVPs for himself + 3 family members
- Leaves a wish for the couple
- May change his RSVP closer to the date if plans change
- **Pain points:** Complicated forms, slow-loading pages, confusing navigation

### Persona 2: The Admin (Tharindu Jayanetti, Groom)
- Manages the entire guest list of ~350 family units
- Needs to know exactly who has/hasn't RSVPed at any time
- Sends reminder messages to non-responders in bulk
- Updates venue details, uploads photos, changes theme colors/fonts over time
- Approves guest wishes before they appear publicly
- Uses the site on both desktop (admin panel) and mobile
- **Pain points:** Needing a developer to make any content change, no visibility into RSVP status

---

## 4. Core Features

### Priority Definitions
- **P0:** Must have at launch. Site is non-functional without these.
- **P1:** Should have at launch. Core experience is incomplete without these.
- **P2:** Nice to have. Can be added post-launch if time allows.

---

### P0 — Must Have at Launch

| ID | Feature | Description |
|---|---|---|
| P0-01 | Guest Login via Code or Name | Guest enters their unique code (e.g., `SILVA-001`) OR their registered name to access the site. System looks up by code first, name second. Ambiguous name matches show a list to confirm. |
| P0-02 | Personalized Digital Invitation | After login, guest sees a personalized invitation page. Admin uploads a base invitation image (JPG/PNG). Guest's name is overlaid via DOM (absolutely positioned CSS, no server-side image manipulation). Admin configures name position, font, size, color via admin panel. |
| P0-03 | RSVP Form — Accept | Guest can accept with: number of participants (capped at their admin-assigned slot count), participant names, and optional WhatsApp number (first visit only). |
| P0-04 | RSVP Form — Decline | Guest can decline. System shows a warm thank-you message: acknowledges their decision graciously and thanks them for responding. RSVP marked as declined in DB. |
| P0-05 | RSVP Change / Update | Guest can change their RSVP at any time from the Invitation page (accept → decline or vice versa, or update participant names). Previous response overwritten. New confirmation message auto-sent. |
| P0-06 | Sticky RSVP Bar | After login, a sticky bar appears at the bottom of every page until the guest RSVPs. Shows: "Amandi & Tharindu are waiting for your response 💍 — Will you join us?" with Accept and Decline buttons. Disappears permanently once responded. "Change response" link remains on Invitation page. |
| P0-07 | Admin Guest Management | Admin can: add guests (name, relationship, slot count → auto-generates unique code), edit guests, soft-delete guests, view all guests with RSVP status, filter by status (pending/accepted/declined) and relationship group. |
| P0-08 | Admin RSVP Dashboard | Real-time stats: total invited, accepted (with headcount), declined, pending. Visual chart. Exportable as CSV. |
| P0-09 | Admin Auth | Single admin login via Supabase Auth (email + password). Only one admin account. Password reset via email. All `/admin/*` routes protected. **Implemented in the prototype** as a single seeded admin account (email/scrypt password hash via `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` env vars, dev-only fallback credentials otherwise), signed session cookie, CSRF-protected login/logout, and route protection on all `/admin/*` and `/api/admin/*` endpoints. Password reset via email is not yet implemented (deferred to the eventual Supabase Auth migration). |
| P0-10 | WhatsApp Number Capture | On first visit after login, guest is prompted (not forced) to enter their WhatsApp number. Stored against their guest record. Used for future admin messaging. |

---

### P1 — Should Have at Launch

| ID | Feature | Description |
|---|---|---|
| P1-01 | Homepage with Countdown | Public homepage showing: couple names (Amandi & Tharindu), wedding date (Monday, 14 December 2026), live countdown timer (days, hours, minutes, seconds), hero image, short welcome message, "Find your invitation" CTA button. |
| P1-02 | Our Story Page | Relationship timeline: admin adds milestones (date, title, short paragraph, optional photo). Childhood photo slideshows: two carousels side by side (Bride's / Groom's), photos uploaded by admin. All editable via admin panel. |
| P1-03 | The Celebration Page | Event cards for each wedding event (e.g., ceremony, reception). Each card: event name, date+day, time, venue name, venue address, venue image, relevant icons. Clicking location opens Google Maps with directions. All events managed via admin panel. |
| P1-04 | Gallery Page | Photo gallery of couple photos uploaded by admin. Grid layout. Lightbox on click. Admin can add/delete/reorder photos. |
| P1-05 | Wishes Page | Guests leave a written wish for the couple. Admin approves/hides wishes before public display. Approved wishes shown in an elegant wall format. |
| P1-06 | Admin Messaging Center | Admin selects guest group (e.g., "all pending"), picks a message template, previews with placeholders filled, sends via WhatsApp / SMS / Email. Message logs stored. Failed messages show retry button. |
| P1-07 | Message Templates | 4 pre-built templates: Initial Invite, First Reminder, Final Reminder, Thank You After RSVP. Placeholders: `[Name]`, `[Code]`, `[Link]`, `[Date]`, `[Venue]`. Admin can edit template body. Channel: WhatsApp / SMS / Email selectable. |
| P1-08 | Auto Thank-You Message | On RSVP acceptance, auto-send thank-you message to guest via WhatsApp (if number provided) or email. Uses "Thank You" template. |
| P1-09 | Admin Event Manager | Admin adds/edits/deletes celebration events: name, date, time, venue name, venue address (Google Maps URL), venue image upload, icon selection, display order. |
| P1-10 | Admin Theme Editor | Global site controls: primary/secondary/accent colors, font family, font style, hero image upload, invitation template upload + name overlay position config, layout/frame/pattern selection. Changes reflect site-wide instantly. **Implemented in the prototype at `/admin/theme`** as one form group per element (Hero Image, Invitation Template + overlay position/font/size/color, Colors, Typography, Wedding Info, Venue), each independently saved. Prototype-scoped deviation: hero/invitation images are entered as a URL rather than uploaded as a file, since Supabase Storage integration is not yet built; layout/frame/pattern selection is not yet implemented. |
| P1-11 | Admin Section Manager | Admin can add new custom content sections to any page (title, content, display order, visibility toggle). Enables couple to expand the site post-launch without a developer. **Implemented in the prototype at `/admin/sections`** — add/edit/toggle-visibility/delete for the five public pages (`home`, `our-story`, `celebration`, `gallery`, `wishes`) and four section types (`text`, `image`, `gallery`, `custom`). |
| P1-12 | Sticky Navigation | Navigation bar fixed at top on all pages. Links: Home, Our Story, The Celebration, Gallery, Invitation, Wishes. Elegant font. Mobile hamburger menu. |
| P1-13 | Mobile Responsiveness | Full functionality on iOS and Android mobile browsers. All pages, forms, admin panel, and RSVP flow work on screens ≥ 320px wide. |

---

### P2 — Nice to Have (Post-Launch)

| ID | Feature | Description |
|---|---|---|
| P2-01 | Accommodation Section | Admin-editable section listing nearby hotels for outstation guests (name, distance, booking link). |
| P2-02 | FAQ Page | Admin-editable FAQ section for common guest questions. |
| P2-03 | Scheduled Message Campaigns | Admin sets a date/time for a reminder message to auto-send to all pending guests. |
| P2-04 | Guest WhatsApp Reply Tracking | Track if guests reply to WhatsApp messages sent via Twilio. |
| P2-05 | Multi-language Support | Support for Sinhala language option for guests. |
| P2-06 | Seating Plan — Table & Seat Assignment | Admin arranges tables and assigns a seat/chair number to each Participant. Guests are grouped by their `RelationshipType` (Relations / Colleagues / Neighbours / Friends) so families and colleagues can be seated together. Admin can create tables (name/number, capacity), drag or assign Participants to seats, see unassigned Participants, and export the plan. Depends on RSVP data being final, so it runs *after* the RSVP cutoff. Guests may optionally be shown their table on the Invitation page. |
| P2-07 | RSVP Cutoff / Headcount Lock | Admin sets a cutoff date after which guests can no longer submit or change an RSVP. Once locked, the headcount is frozen for catering and seating, and the home-page counter reflects the locked figure rather than a live one. Admin can unlock if needed. **Needs clarification before build** — see note below. |

> **P2-07 needs a decision from the project owner.** "Lock the date for counting" can mean either
> (a) an **RSVP cutoff date** — guests can't change their response after it, freezing the headcount
> for catering/seating, or (b) **locking the wedding date itself** so the home-page countdown target
> can't be edited by accident. Confirm which (or both) before implementing.

---

## 5. Out of Scope

The following are explicitly NOT being built:

- Online gift registry or payment integration
- Live streaming of the wedding ceremony
- Photo booth or live photo upload by guests
- Google Sheets / Airtable integration
- Native mobile app (iOS or Android)
- Multi-admin accounts (only one admin: the couple)
- Public-facing RSVP without code/name verification (open RSVPs)
- Automated RSVP reminders on a schedule (P2 — manual sends only at launch)
- Multi-language support at launch (Sinhala — P2 only)
- Social media sharing features
- Video uploads or video gallery
- Any payment or e-commerce functionality
- Third-party wedding planning integrations (venue booking, catering APIs)
- Print-ready invitation generation (couple handles physical cards themselves)

---

## 6. Technical Constraints & Assumptions

### Stack (Non-Negotiable)
```
Frontend:      Next.js 14 (App Router, TypeScript)
Database:      Supabase (Postgres + Auth + Storage)
Hosting:       Vercel (free tier sufficient for ~350 guests)
WhatsApp:      Twilio WhatsApp API (Business API template messages)
SMS:           Twilio SMS
Email:         Resend (free tier: 3,000 emails/month)
File Storage:  Supabase Storage (invitation templates, venue images, gallery photos)
```

### Constraints
- **Budget:** Near-zero running cost. All services on free tiers where possible.
- **Guest scale:** ~350 family units. Not expected to exceed 500 total individual RSVPs.
- **Timeline:** 35 days to production. No scope creep permitted until after launch.
- **Admin count:** Exactly one admin account. No multi-user admin system needed.
- **Invitation personalization:** Name overlay is DOM/CSS only — no server-side image generation. Admin configures overlay position/font/size via theme editor.
- **Physical cards:** Couple prints and distributes physical cards manually. Website generates unique codes only.
- **WhatsApp API:** Twilio WhatsApp requires pre-approved message templates for business-initiated messages. Reminder templates must be submitted for WhatsApp approval before sending.
- **No family unit grouping:** Each family unit gets exactly one unique code. They RSVP for their whole family under that one code.
- **Relationship categories:** Set by admin only (not guest-selectable). Options: Relations, Colleagues, Neighbours, Friends.
- **Guest soft delete:** Deleting a guest in admin performs a soft delete. RSVP data is preserved in the database.
- **Content updates:** All content (events, story, gallery, theme, sections) is managed via admin panel post-launch. No developer involvement required after handoff.

### Assumptions
- Couple has a Twilio account (or will create one) before messaging features are needed
- Couple has a Resend account (or will create one) for email
- Invitation template image (JPG/PNG) will be provided by a third-party designer and uploaded by admin
- Theme colors, fonts, and patterns are not finalized at launch — admin can change them at any time
- Wedding events (ceremony, reception) details will be entered by admin once finalized
- Google Maps links for venues will be standard `https://maps.google.com/?q=` URLs
- Website URL will be a custom domain (e.g., `amandi-tharindu.com`) — domain purchase is outside project scope

---

## 7. Database Schema

```sql
-- Guests (one record per family unit / invited party)
guests (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL,           -- e.g., SILVA-001, auto-generated
  name text NOT NULL,                  -- Primary contact name
  relationship text NOT NULL,          -- Relations | Colleagues | Neighbours | Friends
  slot_count integer NOT NULL,         -- Max participants allowed
  whatsapp_number text,                -- Captured on first visit (optional)
  email text,
  has_visited boolean DEFAULT false,
  rsvp_status text DEFAULT 'pending',  -- pending | accepted | declined
  is_deleted boolean DEFAULT false,    -- Soft delete
  created_at timestamptz DEFAULT now()
)

-- RSVP Responses
rsvp_responses (
  id uuid PRIMARY KEY,
  guest_id uuid REFERENCES guests(id),
  attending boolean NOT NULL,
  participant_names text[],            -- Array of names, max = slot_count
  submitted_at timestamptz,
  updated_at timestamptz
)

-- Wedding Events (ceremony, reception, etc.)
events (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  event_date date NOT NULL,
  event_time time NOT NULL,
  venue_name text NOT NULL,
  venue_address text NOT NULL,
  google_maps_url text,
  venue_image_url text,
  icon text,                           -- Icon identifier for UI
  display_order integer DEFAULT 0
)

-- Story Timeline Milestones
story_milestones (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  milestone_date date,
  description text,
  photo_url text,
  display_order integer DEFAULT 0
)

-- Childhood Photos (for slideshows)
childhood_photos (
  id uuid PRIMARY KEY,
  person text NOT NULL,                -- bride | groom
  photo_url text NOT NULL,
  caption text,
  display_order integer DEFAULT 0
)

-- Gallery Photos
gallery_photos (
  id uuid PRIMARY KEY,
  photo_url text NOT NULL,
  caption text,
  display_order integer DEFAULT 0
)

-- Guest Wishes
wishes (
  id uuid PRIMARY KEY,
  guest_id uuid REFERENCES guests(id),
  guest_name text NOT NULL,
  message text NOT NULL,
  is_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)

-- Message Templates
message_templates (
  id uuid PRIMARY KEY,
  name text NOT NULL,                  -- initial_invite | reminder_1 | reminder_2 | thank_you
  body text NOT NULL,                  -- With placeholders: [Name], [Code], [Link], [Date], [Venue]
  channel text NOT NULL                -- whatsapp | sms | email
)

-- Message Logs
message_logs (
  id uuid PRIMARY KEY,
  guest_id uuid REFERENCES guests(id),
  template_id uuid REFERENCES message_templates(id),
  channel text NOT NULL,
  sent_at timestamptz,
  status text NOT NULL                 -- sent | failed | pending
)

-- Global Theme Settings (single row)
theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_color text DEFAULT '#B8860B',
  secondary_color text DEFAULT '#FFF8DC',
  accent_color text DEFAULT '#8B0000',
  font_family text DEFAULT 'Cormorant Garamond',
  font_style text DEFAULT 'italic',
  hero_image_url text,
  invitation_template_url text,
  invitation_name_top text DEFAULT '45%',       -- CSS top % for name overlay
  invitation_name_left text DEFAULT '50%',      -- CSS left % for name overlay
  invitation_name_font_size text DEFAULT '2rem',
  invitation_name_color text DEFAULT '#5C3317',
  couple_names text DEFAULT 'Amandi & Tharindu',
  wedding_date date DEFAULT '2026-12-14',
  venue_name text,
  venue_address text,
  patterns text,
  custom_css text
)

-- Custom Site Sections
site_sections (
  id uuid PRIMARY KEY,
  page text NOT NULL,                  -- home | our-story | celebration | gallery | wishes
  section_type text NOT NULL,          -- text | image | gallery | custom
  title text,
  content text,
  display_order integer DEFAULT 0,
  is_visible boolean DEFAULT true
)
```

---

## 8. Site Structure & Routing

```
PUBLIC ROUTES
/                          → Home (countdown, couple names, hero, CTA)
/our-story                 → Story timeline + childhood slideshows
/the-celebration           → Event cards with venue details + Google Maps
/gallery                   → Photo gallery
/invitation                → Code/name entry → personalized invitation + RSVP
/wishes                    → Guest wish wall (approved only)

ADMIN ROUTES (all protected by Supabase Auth session)
/admin                     → Login
/admin/dashboard           → RSVP stats, headcount, charts, CSV export
/admin/guests              → Guest CRUD, code generation, RSVP status view
/admin/messages            → Messaging center (template send + logs)
/admin/events              → Celebration event management
/admin/story               → Timeline milestones + childhood photo management
/admin/gallery             → Couple photo management
/admin/wishes              → Wish approval/moderation
/admin/theme               → Global theme editor
/admin/sections            → Custom section manager
```

---

## 9. Acceptance Criteria for P0 Features

### P0-01 — Guest Login via Code or Name
- [ ] Guest enters code → exact match found → session created → redirected to `/invitation`
- [ ] Guest enters name → exact match → session created → redirected to `/invitation`
- [ ] Guest enters name → multiple matches → UI shows list of matches → guest selects → session created
- [ ] Guest enters invalid code or unrecognised name → friendly error shown → no session created
- [ ] Session persists across page navigation (sticky bar works across all pages)
- [ ] Soft-deleted guests cannot log in

### P0-02 — Personalized Digital Invitation
- [ ] Admin uploads a base invitation image via `/admin/theme`
- [ ] Image stored in Supabase Storage, URL saved in `theme_settings`
- [ ] On `/invitation/[code]`, base image renders as a background or full-width element
- [ ] Guest's name overlaid via absolute-positioned DOM element on top of the image
- [ ] Overlay position (top%, left%), font size, font family, and color are configurable by admin
- [ ] Changes to overlay config in admin panel reflect on invitation page without code changes
- [ ] Works correctly on mobile screens

### P0-03 — RSVP Form — Accept
- [ ] Accept button in sticky bar or invitation page opens RSVP modal/section
- [ ] Form shows: participant count selector (1 to slot_count max), participant name fields (one per count), WhatsApp field (pre-filled if already captured)
- [ ] Cannot submit more participants than admin-assigned slot count
- [ ] On submit: `rsvp_responses` row created/updated, `guests.rsvp_status` set to `accepted`
- [ ] Confirmation message shown to guest on success
- [ ] Sticky RSVP bar disappears after successful submission

### P0-04 — RSVP Form — Decline
- [ ] Decline button triggers confirmation step ("Are you sure?")
- [ ] On confirm: `rsvp_responses` created with `attending = false`, `guests.rsvp_status` set to `declined`
- [ ] Warm message displayed: acknowledges decision graciously, thanks guest for responding
- [ ] Sticky RSVP bar disappears after decline
- [ ] No participant name fields shown for declined RSVPs

### P0-05 — RSVP Change / Update
- [ ] After accepting or declining, guest sees "Change your response" link on `/invitation/[code]`
- [ ] Clicking re-opens the RSVP flow (accept or decline)
- [ ] Previous `rsvp_responses` record is updated (not duplicated), `updated_at` refreshed
- [ ] `guests.rsvp_status` updated accordingly
- [ ] New confirmation/thank-you message auto-sent if changed to accepted
- [ ] Sticky bar does NOT reappear after RSVP change (guest has responded)

### P0-06 — Sticky RSVP Bar
- [ ] Bar is NOT visible to guests who are not logged in
- [ ] Bar appears at bottom of every page immediately after guest logs in (if `rsvp_status = pending`)
- [ ] Bar text: "Amandi & Tharindu are waiting for your response 💍 — Will you join us?"
- [ ] Bar has two buttons: Accept (green) and Decline (muted/grey)
- [ ] Bar does not block scrollable content (padding applied to page bottom)
- [ ] Bar disappears permanently once guest submits any RSVP (accept or decline)
- [ ] "Change response" link on Invitation page is separate from the bar

### P0-07 — Admin Guest Management
- [ ] Admin can add a guest: name (required), relationship (dropdown), slot_count (number) → code auto-generated
- [ ] Generated code format: `[SURNAME]-[3-digit-number]` e.g., `SILVA-001`
- [ ] Admin can edit any guest field (name, relationship, slot count)
- [ ] Admin can soft-delete a guest (hidden from guest-facing site, preserved in DB)
- [ ] Guest list shows: name, code, relationship, slot count, RSVP status, WhatsApp number, last updated
- [ ] Admin can filter by: RSVP status (all/pending/accepted/declined), relationship group
- [ ] Admin can search guests by name or code

### P0-08 — Admin RSVP Dashboard
- [ ] Dashboard shows: Total Invited, Total Accepted (families), Total Accepted (individual headcount), Total Declined, Total Pending
- [ ] Visual chart (bar or pie) of RSVP breakdown
- [ ] "Export CSV" button downloads full guest list with RSVP status and participant names
- [ ] Data is real-time (no manual refresh needed)

### P0-09 — Admin Auth
- [ ] `/admin/*` routes return 401/redirect to `/admin` if no valid session
- [ ] Admin logs in with email + password via Supabase Auth
- [ ] "Forgot password" link triggers Supabase password reset email
- [ ] Session persists across browser tabs
- [ ] Admin can log out

### P0-10 — WhatsApp Number Capture
- [ ] On first visit (after code/name login), a modal or inline prompt asks for WhatsApp number
- [ ] Field is optional — guest can skip
- [ ] If entered, stored in `guests.whatsapp_number`
- [ ] Prompt does NOT appear on subsequent visits if number already stored
- [ ] Prompt does NOT appear if guest has already RSVPed (show on first login before RSVP only)

---

## 10. Edge Cases & Failure Modes

### Edge Cases
| Scenario | Expected Behaviour |
|---|---|
| Guest enters wrong code/name | Friendly error: "We couldn't find your invitation. Please check the code on your card." |
| Duplicate guest names in DB | Show list of matches with relationship shown; guest selects correct one |
| Guest submits more participants than slot allows | Frontend caps the form; backend validates and rejects if exceeded |
| Guest RSVPs, then visits again | Shows current RSVP status + "Change response" option; no duplicate DB entry |
| Guest skips WhatsApp number | RSVP still works; excluded from WhatsApp campaigns; can add number later from invitation page |
| Admin deletes a guest who already RSVPed | Soft delete; guest cannot log in; RSVP data preserved in `rsvp_responses` |
| Admin uploads wrong invitation template | Re-upload via `/admin/theme`; URL replaced in `theme_settings` instantly |
| Guest changes RSVP from accepted to declined | `rsvp_responses.attending` updated to false; headcount adjusted in dashboard |
| Two guests submit simultaneously | Supabase handles concurrent writes; `updated_at` timestamp resolves latest state |
| Wish submitted by guest | Held for admin approval; not publicly visible until approved |

### Failure Modes & Rollback
| Failure | Recovery Strategy |
|---|---|
| Supabase service outage | Static pages (Home, Story, Celebration, Gallery) continue to serve via Vercel CDN. RSVP form shows "We'll be right back" message. No data loss. |
| Twilio API failure on message send | Message status logged as `failed` in `message_logs`. Admin sees failed count in messaging center with per-message retry button. |
| Resend email API failure | Same as Twilio — logged as failed, retry available in admin. |
| Vercel deployment failure | Vercel automatically preserves last successful deployment. Instant rollback available from Vercel dashboard. |
| Theme broken by bad CSS/color input | "Reset to defaults" button in `/admin/theme` restores `theme_settings` to defaults. |
| Admin locked out | Supabase Auth "Forgot password" sends reset email. No secondary admin account needed. |
| Invitation image upload fails | Error shown in admin with file size/format guidance. Previous template URL unchanged. |

---

## 11. Non-Functional Requirements

- **Performance:** Lighthouse score ≥ 85 on mobile. Images lazy-loaded. Next.js image optimization enabled.
- **Security:** All admin routes protected by Supabase RLS policies + Next.js middleware. Guest sessions are read-only (cannot access other guest data). No sensitive data (codes, WhatsApp numbers) exposed in client-side JS bundles.
- **Accessibility:** WCAG 2.1 AA compliance for all guest-facing pages. Proper alt text, keyboard navigation, sufficient color contrast.
- **SEO:** Public pages (Home, Our Story, Celebration, Gallery) have proper meta tags. Invitation/RSVP pages are noindex.
- **Mobile-first:** Designed mobile-first. All breakpoints: 320px, 768px, 1024px, 1440px.
- **Browser support:** Chrome, Safari, Firefox — latest 2 versions. Samsung Internet (common in Sri Lanka).

---

## 12. Message Template Defaults

These are pre-seeded into `message_templates` on first deploy:

**Initial Invite (WhatsApp/SMS)**
```
Dear [Name], you are cordially invited to the wedding of Amandi & Tharindu on [Date]. 
Please view your personal invitation and RSVP at [Link] using your code: [Code]. 
We look forward to celebrating with you! 💍
```

**First Reminder (WhatsApp/SMS)**
```
Dear [Name], this is a gentle reminder to RSVP for Amandi & Tharindu's wedding on [Date]. 
Your personal invitation: [Link] (Code: [Code]). 
We'd love to know if you can join us! 🎊
```

**Final Reminder (WhatsApp/SMS)**
```
Dear [Name], we're finalising our guest list for our wedding on [Date]. 
Could you please confirm your attendance at [Link]? 
Thank you so much — Amandi & Tharindu 💛
```

**Thank You After RSVP (WhatsApp/SMS)**
```
Dear [Name], thank you so much for confirming your attendance! 
We can't wait to celebrate with you on [Date] at [Venue]. 
With love, Amandi & Tharindu 💍🎊
```

---

## 13. Folder Structure (Next.js 14 App Router)

```
/
├── app/
│   ├── page.tsx                    # Home
│   ├── our-story/page.tsx
│   ├── the-celebration/page.tsx
│   ├── gallery/page.tsx
│   ├── invitation/page.tsx         # Code/name entry
│   ├── invitation/[code]/page.tsx  # Personalized invitation + RSVP
│   ├── wishes/page.tsx
│   └── admin/
│       ├── page.tsx                # Admin login
│       ├── dashboard/page.tsx
│       ├── guests/page.tsx
│       ├── messages/page.tsx
│       ├── events/page.tsx
│       ├── story/page.tsx
│       ├── gallery/page.tsx
│       ├── wishes/page.tsx
│       ├── theme/page.tsx
│       └── sections/page.tsx
├── components/
│   ├── guest/                      # StickyRsvpBar, InvitationCard, RsvpModal, WishForm
│   ├── admin/                      # GuestTable, MessageComposer, ThemeEditor, etc.
│   ├── public/                     # Countdown, EventCard, StoryTimeline, Gallery, etc.
│   └── ui/                         # Shared UI primitives
├── lib/
│   ├── supabase/                   # Client, server, middleware
│   ├── twilio/                     # WhatsApp + SMS send functions
│   ├── resend/                     # Email send functions
│   └── utils/                      # Code generator, placeholder replacer, etc.
├── middleware.ts                    # Protect /admin/* routes
└── supabase/
    └── migrations/                 # All DB migration SQL files
```

---

## 14. Chapter 2 — Productization (explicitly NOT in scope now)

The project owner intends to reuse this application for other couples commercially **after**
Amandi & Tharindu's wedding has launched and run successfully. This section records that
intent so architectural decisions don't accidentally foreclose it.

**Nothing in this section is to be built during Chapter 1.** Do not create speculative
infrastructure for it. Chapter 1 succeeds by delivering one excellent wedding website.

### Chapter boundary

| | Chapter 1 (now) | Chapter 2 (later) |
|---|---|---|
| Users | One couple: Amandi & Tharindu | Many couples |
| Admin | Exactly one admin account | Per-couple accounts, roles, billing |
| Data | Single set of tables | Tenant-scoped rows |
| Goal | A reliable, beautiful wedding site | A sellable product |

### What Chapter 2 would require

- `couples` (or `tenants`) table, with every existing table gaining a tenant key
- Per-tenant isolation enforced at the database level (Supabase RLS policies)
- Self-service signup, subscription/billing, and plan limits
- Per-tenant custom domains or subdomains
- Template/preset system so a new couple starts from a design rather than a blank site
- Onboarding flow replacing developer setup
- Support, backups, and data-export obligations that come with holding other people's guest data

### Cheap things to preserve now (no extra work, just discipline)

These cost nothing today and avoid painful rewrites later:

- Keep business logic in `src/` modules separate from route/UI code — already the pattern
- Keep the repo layer (`guestRepo`, `themeRepo`, `sectionsRepo`) as the only database access
  path, so adding a tenant filter later is one change per repo rather than hundreds
- Avoid hardcoding "Amandi & Tharindu" in code — read it from `ThemeSettings` (done as of
  2026-08-23; the header, footer, and home page now derive from settings)
- Keep migrations additive and ordered

### Explicit warning

Multi-tenancy is the single most expensive thing to retrofit into an application, **and it
carries real legal weight** — holding other couples' guest lists and phone numbers makes you
a data processor with obligations you don't have when it's your own wedding. Treat Chapter 2
as a separate project with its own PRD, not as a feature added to this one.

---

*Document version: 1.1 | Created: August 2026 | Last updated: 23 August 2026 | Wedding date: Monday, 14 December 2026*
*Couple: Amandi Wijesundara & Tharindu Jayanetti*
*For questions contact the project owner directly — this document is the single source of truth.*
