# Amandi & Tharindu — Wedding Website PRD v3

---

## 1. Product Overview

**Amandi & Tharindu Wedding Website** is a bespoke, luxury wedding web application crafted specifically for the wedding of Amandi & Tharindu.

### Dual Purpose

1. **Public Experience:** A fine-art public wedding site featuring a Chateau Green oil-canvas aesthetic, botanical accents, ambient audio engine, story milestones, event schedules, photo gallery, and a guest wishes wall.
2. **Personalized Guest & RSVP Portal:** A secure, personalized invitation experience featuring an interactive digital wax seal, per-attendee seat allocation, individual guest name inputs, dietary preference tracking, and persistent RSVP status.

### Product Principle

> «Build a beautiful, reliable, and privacy-first wedding website. Build platform capabilities only after the core wedding experience is proven.»

---

## 2. Initial Product Scope

### Public Experience

- **Home:** Hero canvas banner with couple typography and a live countdown clock (Days, Hours, Minutes, Seconds).
- **Ambient Audio Sounding Engine:** Floating audio controller with multi-track ambient instrumental options (Classical Piano, Acoustic Strings, Traditional Instrumental) and user-triggered play/pause/mute controls.
- **Our Story:** Fine-art milestone cards ("How We Met", "The Proposal", "The Wedding") with botanical borders and fine-line illustrations.
- **Celebration:** Event schedules (Poruwa Ceremony & Reception), dress code guidelines, parking/hotel notes, and an interactive Google Maps venue direction link.
- **Gallery:** Lightbox-enabled photo gallery with oil-painting canvas borders.
- **Wishes:** Public wall for well-wishers to submit and view congratulations.
- **Guest Access Portal:** Dual-authentication modal (Invitation Code & Name Search with Ambiguous Match Resolution).

### Guest Experience

- **Authentication:** Secure code-based (`AT-2026-XXXX`) or tokenized name search login.
- **Ambiguous Match Resolution:** Safe candidate selection modal when multiple names match, without exposing the full guest roster.
- **Interactive Digital Wax Seal:** Animated wax seal that opens/unfolds the personalized invitation.
- **Personalized Invitation:** Tailored guest name, assigned seat quota, event times, venue details, and dress code.
- **Detailed RSVP Flow:** Attendance selection (Joyfully Accept / Regretfully Decline), per-attendee headcount, individual guest name inputs, and specific dietary requirements.
- **Optional Message:** Guests may include a personal message to the couple.
- **RSVP Persistence & Editing:** Persistent response state with the ability for guests to return later and modify responses.
- **Sticky RSVP Reminder:** Non-intrusive banner prompting unresponded guests to submit their RSVP; disappears once responded.

### Admin Experience

- **Authentication:** Secure admin login with session state protection.
- **Dashboard & RSVP Analytics:** Real-time overview cards (Total Invited, Confirmed Attending, Awaiting Response, Declined, Total Headcount).
- **Theme & Style Customizer:** Live switcher for color palettes (Chateau Green, Imperial Gold, Rose Blush, Midnight Silver, Terracotta) and font typography (Cormorant, Playfair, Cinzel, Inter).
- **Content & Venue Manager:** Dynamic editor for venue name, hall/ballroom details, address, Google Maps link, ceremony times, dress code, ambient audio track URL, and wedding date/time (auto-syncing live countdown).
- **Guest Roster Management:** Search, add guest, edit details, soft-delete/reactivate, view invitation codes, and inspect per-guest dietary notes and RSVP status.
- **RSVP Management:** View, filter, and search responses; see attendance totals and the latest RSVP state per guest.

---

## 3. Explicitly Out of Scope for Initial Launch

The following features must **not** be implemented during the initial wedding launch:

- Multi-couple tenant architecture
- Automated WhatsApp / SMS / email gateway integrations
- Payment gateway & registry store monetization
- Drag-and-drop page builder engines
- AI-generated content tools
- Generic SaaS account management
- Complex visual website builder

Do not create speculative infrastructure for these features. They may become future platform capabilities.

---

## 4. Product Architecture

### Production Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Database & Auth | Supabase (PostgreSQL, Auth, Row Level Security) |
| Storage | Supabase Storage Bucket |
| Deployment | Vercel |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js App Router                     │
│                                                             │
│  Public Pages  │  Guest Invitation Portal  │  Admin Suite   │
│                     API Route Handlers                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Supabase Backend                      │
│                                                             │
│  PostgreSQL  │  Row Level Security (RLS)  │  Storage Bucket │
└─────────────────────────────────────────────────────────────┘
```

The application keeps business logic separate from UI components so that guest and RSVP modules remain cleanly reusable and platform-ready.

---

## 5. Core Data Model

Database naming uses `snake_case`. Application-level TypeScript objects use `camelCase` through a mapping/data-access layer.

### `wedding_details`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary Key |
| `bride_name` | TEXT | |
| `groom_name` | TEXT | |
| `wedding_date` | TIMESTAMPTZ | |
| `venue_name` | TEXT | |
| `ballroom_hall` | TEXT | |
| `venue_address` | TEXT | |
| `google_maps_url` | TEXT | |
| `poruwa_ceremony_time` | TEXT | |
| `reception_time` | TEXT | |
| `dress_code` | TEXT | |
| `hero_image_url` | TEXT | |
| `font_family` | TEXT | |
| `color_scheme` | TEXT | |
| `active_audio_track` | TEXT | |
| `updated_at` | TIMESTAMPTZ | |

### `guests`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary Key |
| `invitation_code` | TEXT | Unique |
| `full_name` | TEXT | |
| `normalized_name` | TEXT | For name-based lookup |
| `email` | TEXT | |
| `phone` | TEXT | |
| `allowed_guest_count` | INT | Seat quota |
| `is_deleted` | BOOLEAN | Soft-delete flag |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Additional fields may be introduced only when required by an actual feature.

### `rsvp_responses`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary Key |
| `guest_id` | UUID | FK → `guests.id` |
| `attendance_status` | TEXT | `'attending'` \| `'declined'` \| `'pending'` |
| `guest_count` | INT | |
| `attendee_names` | TEXT[] | Individual attendee list |
| `dietary_requirements` | TEXT | |
| `message` | TEXT | Optional message to couple |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `wishes`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary Key |
| `guest_name` | TEXT | |
| `message` | TEXT | |
| `is_approved` | BOOLEAN | Moderation flag |
| `created_at` | TIMESTAMPTZ | |

---

## 6. Guest Access & Session Architecture

### Flow

```
Guest Login
├── Option A: Invitation Code (e.g., AT-2026-PERERA)
│     └── Direct Authenticated Session
│
└── Option B: Name Search (Tokenized Normalization)
      ├── Single Match ──> Direct Authenticated Session
      └── Multiple Matches ──> Ambiguous Resolution Modal
                                    └── Guest Selects ──> Authenticated Session
                                          └── Personalized Invitation
```

### Requirements

**Valid invitation code:** Identifies the guest, creates a guest session, and grants access to the personalized invitation.

**Invalid invitation code:** Must not create a session, must return a friendly error, and must not reveal unnecessary guest information.

**Deleted guest:** A soft-deleted guest (`is_deleted = true`) must be strictly forbidden from authenticating.

**Name login:** Matching is normalized to handle reasonable differences in capitalization, leading/trailing spaces, and repeated whitespace. The full guest roster must not be exposed through name search.

### Session Security Requirements

- HTTP-only cookie
- Secure cookie in production
- SameSite protection
- Signed/encrypted session mechanism
- Server-side validation on every request
- Appropriate session expiration
- No sensitive guest information stored in client-accessible cookies

---

## 7. Personalized Invitation

After authentication, the guest should see a personalized invitation featuring:

- Interactive digital wax seal animation (opens to reveal invitation)
- Guest full name and assigned seat quota
- Wedding information, venue, ballroom/hall
- Event times (Poruwa Ceremony & Reception)
- Dress code
- Invitation message
- Current RSVP status
- RSVP action (submit or modify)

The exact visual design follows the wedding's Chateau Green luxury visual direction.

---

## 8. RSVP Flow

The RSVP experience must be simple and mobile-first.

```
Invitation
↓
Attendance selection (Joyfully Accept / Regretfully Decline)
↓
Seat count picker (bound to guest quota)
↓
Individual attendee name inputs (one per seat)
↓
Dietary requirements per attendee
↓
Optional personal message to couple
↓
Submit
↓
Confirmation
```

Guests must be able to return later and change their RSVP. The system maintains the latest valid response.

---

## 9. Sticky RSVP Reminder

If the guest has not submitted an RSVP, a persistent RSVP reminder bar remains visible on the personalized invitation. Once the guest responds, the reminder disappears or updates to reflect the confirmed status. The reminder must not obstruct important content on mobile devices.

---

## 10. Public Website Design Standards

All public pages use a shared layout/wrapper. The design must be:

- Premium and elegant, romantic without being excessive
- Chateau Green oil-canvas aesthetic with botanical accents
- Fine-art milestone cards and canvas frame overlays
- Mobile-first and fast
- Visually consistent throughout
- Appropriate for the Magnolia Ballroom wedding environment

---

## 11. Admin Panel — Full Specification

### Routes

```
/admin
├── Login
├── Dashboard
├── Guests
├── RSVPs
└── Settings (Theme, Content, Venue)
```

### Dashboard

Real-time overview metrics:
- Total invited guests
- RSVP responded / awaiting response
- Attending / not attending counts
- Total confirmed headcount

### Guest Management

- View and search guests
- Add guest (with seat quota)
- Edit guest details
- Soft-delete / reactivate guest
- View RSVP status and dietary notes per guest

### RSVP Management

- View all responses
- Filter by status (Attending / Declined / Pending)
- Search guests
- See attendance totals and latest RSVP state

### Theme & Style Customizer

- 5 color palettes: Chateau Green, Imperial Gold, Rose Blush, Midnight Silver, Terracotta
- 4 font families: Cormorant, Playfair, Cinzel, Inter
- Hero image upload

### Content & Venue Manager

- Venue name, ballroom/hall, address, Google Maps link
- Poruwa ceremony time, reception time, dress code
- Ambient audio track URL
- Wedding date/time picker (auto-syncs the live homepage countdown)

---

## 12. Testing Strategy

Use TDD for all meaningful feature slices. Each slice must include:

1. Acceptance criteria
2. Tests
3. Implementation
4. Integration verification

### Required Test Flows

| Flow | Description |
|---|---|
| Code login | Valid invitation code creates session |
| Name login | Single name match creates session |
| Ambiguous name login | Multiple matches trigger resolution modal |
| Invalid login | Invalid code returns error, no session |
| Deleted guest login | Soft-deleted guest is blocked |
| Invitation access | Authenticated guest sees personalized invitation |
| Wax seal interaction | Seal animation triggers invitation reveal |
| RSVP submission | Full RSVP (names, dietary) is persisted |
| RSVP update | Guest can return and modify RSVP |
| Session validation | Server validates session on protected routes |
| Admin authentication | Admin login gate works correctly |
| Admin guest management | CRUD operations and soft-delete function correctly |
| Admin RSVP dashboard | Metrics and filters are accurate |

A feature must not be marked complete until its relevant tests pass.

---

## 13. Security Requirements

Before production:

- Validate all user input server-side
- Rate-limit login attempts
- Protect admin routes from unauthorized access
- Protect guest routes from unauthorized access
- Use secure, HTTP-only, signed session cookies
- Prevent unauthorized cross-guest data access
- Prevent guest enumeration where practical
- Configure Supabase Row Level Security (RLS) policies on all tables
- Do not expose secrets in client-side code
- Maintain an up-to-date `.env.example`
- Conduct a guest privacy/data exposure review before launch

---

## 14. Deployment

```
Git Repository
↓
Vercel (CI/CD)
↓
Next.js Application
↓
Supabase (PostgreSQL + Storage)
```

Production deployment requires explicit human approval per `HITL.md`. Do not deploy automatically.

---

## 15. Future Product Direction

The architecture must leave room for this project to become a reusable wedding website platform. Avoid hard-coding assumptions that prevent future multi-couple support, but keep simplicity as the primary concern over premature abstraction.

Possible future entities:

- `couples`
- `theme_settings`
- `sections`
- `message_templates`
- `message_logs`

These must **not** be implemented during the initial Amandi & Tharindu launch.

---

## 16. Product Success Criteria

The first production version is successful when:

1. A guest can access their invitation securely using an invitation code.
2. A guest can find themselves using their name.
3. Ambiguous names can be resolved safely without exposing the guest roster.
4. The interactive wax seal provides an engaging invitation unboxing experience.
5. The guest sees a personalized invitation with correct seat quota and event details.
6. The guest can submit a full RSVP including attendee names and dietary requirements.
7. The guest can later return and change their RSVP.
8. All RSVPs are persisted reliably in Supabase.
9. The admin can manage guests, view RSVPs, and customize theme and venue content in real time.
10. The public website looks polished, luxury-grade, and wedding-ready on mobile.
11. Security and privacy issues are reviewed and resolved before launch.
12. The ambient audio engine, wax seal, countdown clock, and Google Maps integration work as specified.

> **The goal is not maximum feature count. The goal is a reliable, beautiful, and production-ready wedding experience.**
