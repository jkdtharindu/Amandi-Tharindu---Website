> Project: Amandi & Tharindu Wedding Website | Generated: 2026-08-29
> Read alongside `amandi-tharindu-wedding-PRD.md` (scope) and `WEDDING_UI_UX_SPEC.md` (design).
> Do not confuse with `SENHILL_UBIQUITOUS_LANGUAGE.md` — that file defines terms for an entirely
> separate project. The two vocabularies do not overlap and must never be mixed.

# Ubiquitous Language — Amandi & Tharindu Wedding Website

This document defines the canonical vocabulary for the wedding website and guest portal.
Use these terms consistently in code, comments, tests, database columns, commit messages,
and AI conversations. Do not introduce alternate names for the same concept.

**This file is the source of truth.** `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, and
`WEDDING_UI_UX_SPEC.md` all defer to the names defined here.

---

## People & Roles

### Guest
- **Canonical name:** `Guest`
- **Table:** `guests`
- **Definition:** One invited party — a Single person, a Couple, or a Family unit — who
  receives a physical wedding card containing a unique `InvitationCode` and QR code. One
  `Guest` record = one card = one `InvitationCode`. A Guest is not a user account; they
  authenticate only by presenting their `InvitationCode`.
- **Never:** `user`, `invitee` (in code/schema — acceptable in prose only), `attendee`
  (that is a `Participant`).

### Participant
- **Canonical name:** `Participant`
- **Field:** `rsvp_responses.participant_names` (array)
- **Definition:** An individual person named when a Guest submits an acceptance RSVP. One
  Guest may have multiple Participants, up to their `slot_count`. Participants are not
  separate database rows — they are stored as a `text[]` array on `rsvp_responses`.
- **Never:** `attendee`, `member`, `guest` (Guest is the invitation unit, not the individual).

### Groom Admin
- **Canonical name:** `GroomAdmin`
- **Role value:** `groom` (on `admin_users.role`)
- **Definition:** Tharindu Jayanetti. Super admin — full access to all site content, both
  guest lists, all admin features, and admin account management.
- **Never:** `superuser`, `owner`, `admin1`.

### Bride Admin
- **Canonical name:** `BrideAdmin`
- **Role value:** `bride` (on `admin_users.role`)
- **Definition:** Amandi Wijesundara. Second admin — full access to her own `GuestPartition`
  and all site content. Cannot edit or view Groom's guest records.
- **Never:** `admin2`, `secondary admin`.

### InvitedBy
- **Canonical name:** `InvitedBy`
- **Field:** `guests.invited_by` (enum: `groom` | `bride`)
- **Definition:** Which admin added this Guest. Auto-set to the logged-in admin's role at
  creation time — never editable after creation. Determines which admin's WhatsApp number
  is shown in the `WhatsAppConfirmationButton` after RSVP.
- **Never:** `added_by`, `owner`, `source`.

---

## Guest Identity & Access

### InvitationCode
- **Canonical name:** `InvitationCode`
- **Field:** `guests.code`
- **Definition:** A unique string auto-generated when a Guest is added, in the format
  `SURNAME-NNN` (e.g. `SILVA-001`). Printed on the physical wedding card and encoded in the
  QR code. The only authentication credential for guests — there is no password, no name
  login.
- **Never:** `access_code`, `token`, `password`, `key`.
- **Format rule:** Uppercase surname, hyphen, zero-padded 3-digit sequence. Collision-free
  within the system — code generation must check for uniqueness before persisting.

### GuestSession
- **Canonical name:** `GuestSession`
- **Definition:** A server-side session created when a Guest presents a valid
  `InvitationCode`. Persists across page navigation. Stores the `guest_id` and is used to
  gate all post-login pages and the sticky `RSVPBar`. Not a JWT — implemented as a signed
  session cookie.
- **Never:** `auth token`, `login state`, `user session`.

### InvitationType
- **Canonical name:** `InvitationType`
- **Field:** `guests.invitation_type` (enum: `single` | `couple` | `family`)
- **Definition:** The category of the invited party:
  - `single` — one named individual (e.g. "Mr. Nimal Silva")
  - `couple` — two people on one card (e.g. "Mr. & Mrs. Perera")
  - `family` — a household unit with an admin-assigned `slot_count` (e.g. "The Silva Family")
- **UI impact:** Determines how `display_name` is typically phrased and the default
  `slot_count` offered in the admin add-guest form (1 / 2 / admin-entered).
- **Never:** `type`, `category`, `unit_type`.

### DisplayName
- **Canonical name:** `DisplayName`
- **Field:** `guests.display_name`
- **Definition:** The exact text that appears on the invitation template image, rendered in
  **Great Vibes** (script/calligraphy font) as the name overlay. Admin enters this at guest
  creation — it is not derived automatically. Examples: `"Mr. Nimal Silva"`,
  `"Mr. & Mrs. Perera"`, `"The Silva Family"`. Must be HTML-escaped before rendering.
- **Never:** `name`, `guest_name`, `full_name` (those are different fields for internal
  use — `display_name` is specifically the invitation-facing form of the name).

---

## Guest Classification

### RelationshipCategory
- **Canonical name:** `RelationshipCategory`
- **Field:** `guests.relationship_category`
- **Enum values:** `family` | `relations` | `friends` | `colleagues` | `neighbours` | `invitees`
- **Definition:** The broad category describing this Guest's relationship to the couple.
  Set by the admin at guest creation — not guest-selectable. Used for filtering in the
  admin guest list and for seating grouping at the P2 stage.
  - `family` — immediate family members
  - `relations` — extended relatives
  - `friends` — personal friends
  - `colleagues` — work connections
  - `neighbours` — neighbourhood connections
  - `invitees` — others who don't fit the above (never labelled "others" in the UI —
    that phrasing is intentionally avoided as it implies lower priority)
- **Never:** `relationship`, `group`, `type` (ambiguous — always use the full term).

### SubGroup
- **Canonical name:** `SubGroup`
- **Field:** `guests.sub_group`
- **Definition:** A custom label within a `RelationshipCategory` that groups guests for
  seating purposes at the P2 stage. Admin-entered free text — e.g. `"School Friends"`,
  `"Office Team"`, `"Perera Clan"`, `"Temple Road Neighbours"`. Optional — not required
  at guest creation. Used at P2 seating stage to seat members of the same SubGroup together.
- **Never:** `tag`, `label`, `group_name` (in code — always `sub_group` in the schema).

### GuestPartition
- **Canonical name:** `GuestPartition`
- **Definition:** The set of `Guest` records belonging to one admin — i.e. all guests where
  `invited_by = 'groom'` (Groom's partition) or `invited_by = 'bride'` (Bride's partition).
  Not a database table — a logical grouping enforced at the query/RLS layer. Each admin can
  only read and edit their own partition's guest records.
- **Never:** `guest_list`, `group`, `segment`.

---

## RSVP

### RSVPStatus
- **Canonical name:** `RSVPStatus`
- **Field:** `guests.rsvp_status`
- **Enum values:** `pending` | `accepted` | `declined`
- **Definition:** The current RSVP state of a Guest invitation unit.
  - `pending` — no response yet (default at creation)
  - `accepted` — Guest has confirmed attendance (with Participant names and count)
  - `declined` — Guest has declined
- **Never:** `confirmed`, `rejected`, `attending` (that is a field on `RSVPResponse`),
  `yes`/`no`.

### RSVPResponse
- **Canonical name:** `RSVPResponse`
- **Table:** `rsvp_responses`
- **Definition:** The record created or updated when a Guest submits their RSVP. One row
  per Guest (upsert — not a history log). Contains: `attending` (boolean), `participant_names`
  (text array, max = `slot_count`), `submitted_at`, `updated_at`.
- **Never:** `rsvp`, `response`, `submission`.

### SlotCount
- **Canonical name:** `SlotCount`
- **Field:** `guests.slot_count`
- **Definition:** The maximum number of Participants this Guest may register in their
  acceptance RSVP. Set by the admin at guest creation. The RSVP form enforces this cap on
  the frontend; the API validates it on the backend.
- **Never:** `capacity`, `seats`, `max_guests`, `allowance`.

---

## UI & Interaction Terms

### PreLoginScreen
- **Canonical name:** `PreLoginScreen`
- **Definition:** The only page visible to unauthenticated visitors. Shows the couple's
  names in animated Cormorant Garamond typography and a single `InvitationCode` input field.
  No navigation, no countdown, no other content. The entire site is gated behind this screen.
- **Never:** `landing page` (that implies public content — this screen is a gate, not a
  welcome), `home page` (that is a separate post-login page), `login page`.

### EnvelopeAnimation
- **Canonical name:** `EnvelopeAnimation`
- **Definition:** The CSS animation (~2s total) that plays after a valid `InvitationCode` is
  entered. A sealed envelope appears, the flap lifts (~0.8s), the `InvitationCard` slides out,
  the envelope fades away. Implemented in pure CSS — no JavaScript animation library.
- **Never:** `intro animation`, `loading animation`, `transition`.

### InvitationCard
- **Canonical name:** `InvitationCard`
- **Definition:** The personalized invitation displayed after the `EnvelopeAnimation`. Shows
  the admin-uploaded `InvitationTemplate` image with the Guest's `DisplayName` overlaid in
  **Great Vibes** script, absolutely positioned per admin-configured overlay settings. Falls
  back to a styled HTML/CSS card when no template is uploaded.
- **Never:** `invitation page` (that is the route — `/invitation/[code]`; the card is the
  component within it), `invite card`.

### InvitationTemplate
- **Canonical name:** `InvitationTemplate`
- **Field:** `theme_settings.invitation_template_url`
- **Definition:** The base image (JPG/PNG, 1080×1520px portrait) uploaded by the admin that
  forms the background of the `InvitationCard`. Designed by a stationer to match the physical
  wedding card. Uploaded via `/admin/theme` to Supabase Storage.
- **Never:** `template image`, `background image`, `card image`.

### NameOverlay
- **Canonical name:** `NameOverlay`
- **Definition:** The `DisplayName` text rendered in **Great Vibes** font, absolutely
  positioned over the `InvitationTemplate` image. Position (top%, left%), font size, and
  colour are configurable by the admin via `/admin/theme`. HTML-escaped before rendering.
- **Never:** `name text`, `guest name`, `label`.

### RSVPBar (Sticky)
- **Canonical name:** `RSVPBar`
- **Definition:** A fixed-bottom bar visible on every page after login while the Guest's
  `RSVPStatus` is `pending`. Slides up on first appearance. Contains Accept and Decline
  actions. Disappears permanently once the Guest submits any RSVP (including a change).
- **Never:** `RSVP banner`, `sticky bar`, `footer bar`.

### RSVPReveal
- **Canonical name:** `RSVPReveal`
- **Definition:** The inline form that expands below the `InvitationCard` when Accept is
  tapped — not a modal, not a new page. Animates open via max-height CSS transition (~300ms).
  Contains participant count selector, participant name inputs, and optional WhatsApp field.
- **Never:** `RSVP modal`, `RSVP form` (acceptable in prose, but `RSVPReveal` is the
  component name in code), `RSVP popup`.

### WhatsAppConfirmationButton
- **Canonical name:** `WhatsAppConfirmationButton`
- **Definition:** The button that appears after a successful acceptance submission. Opens
  WhatsApp to the correct admin's number (`invited_by` determines whose number is shown —
  Groom's guests → Groom's WhatsApp, Bride's guests → Bride's WhatsApp) with a pre-filled
  message. Implemented as a `wa.me` deep link — not a Twilio send.
- **Never:** `WhatsApp button`, `confirm button`, `share button`.

---

## Admin & Content Terms

### ThemeSettings
- **Canonical name:** `ThemeSettings`
- **Table:** `theme_settings` (single row)
- **Definition:** The global site configuration row: palette, font choice, hero image,
  `InvitationTemplate` URL, `NameOverlay` configuration, couple names, wedding date, venue,
  and admin WhatsApp numbers (Groom + Bride — used by `WhatsAppConfirmationButton`).
- **Never:** `site settings`, `config`, `theme`.

### ThemePalette
- **Canonical name:** `ThemePalette`
- **Field:** `theme_settings.palette_name`
- **Definition:** A named, pre-verified set of four colour tokens (Primary / Background /
  Accent / Ink) selected from the admin's palette picker. All approved palettes pass WCAG 2.1
  AA. The active palette's tokens are emitted as CSS custom properties site-wide.
  Current approved palettes: Chateau Green, Imperial Gold, Rose Blush, Midnight Silver,
  Terracotta, Modern Royal Romance.
- **Never:** `color scheme`, `theme colors`, `palette`.

### FontChoice
- **Canonical name:** `FontChoice`
- **Field:** `theme_settings.font_choice`
- **Definition:** A named heading + body font pairing selected from the admin's font picker.
  Locked to `Cormorant Garamond + Montserrat` as the default ("Modern Royal Romance" brief).
  Future pairings may be added. Fonts are self-hosted `.woff2` — no CDN dependency.
- **Never:** `font`, `typography`, `font_family`.

### SiteSection
- **Canonical name:** `SiteSection`
- **Table:** `site_sections`
- **Definition:** A custom content block added by admin to any public page (home, our-story,
  celebration, gallery, wishes). Has a type (`text` | `image` | `gallery` | `custom`),
  title, content, display order, and visibility toggle. Visible sections render on the
  corresponding public page.
- **Never:** `section`, `content block`, `widget`.

### MessageTemplate
- **Canonical name:** `MessageTemplate`
- **Table:** `message_templates`
- **Definition:** A pre-built or admin-edited message body for a specific communication
  event (Initial Invite, First Reminder, Final Reminder, Thank You After RSVP). Supports
  placeholders: `[Name]`, `[Code]`, `[Link]`, `[Date]`, `[Venue]`. Has a channel
  (`whatsapp` | `sms` | `email`).
- **Never:** `template`, `message`, `notification template`.

### MessageLog
- **Canonical name:** `MessageLog`
- **Table:** `message_logs`
- **Definition:** A record of one message send attempt to one Guest via one channel. Status:
  `sent` | `failed` | `pending`. Failed logs show a retry button in the admin messaging center.
- **Never:** `log`, `send record`, `message history`.

---

## Out of Scope — Do Not Introduce These Terms in Code

The following concepts were discussed and explicitly deferred to P2 or Chapter 2. Do not
create tables, fields, or components for these during Chapter 1:

- `TableAssignment` / `SeatingTable` / `SeatNumber` — P2 seating plan
- `QRBoardingPass` / `CheckInQR` — P2 digital boarding pass
- `SeatingVisualizer` / `FloorPlanCanvas` — P2 admin drag-and-drop seating
- `Tenant` / `CoupleAccount` — Chapter 2 multi-tenancy; not in this codebase
- `BaseRate` / `Subscription` / `Billing` — Chapter 2 commercial features

---

## Schema Delta — Fields Added by Grill Me Session (2026-08-29)

The following fields are **required additions** to the `guests` table schema. The existing
`DATABASE_SCHEMA.md` does not yet reflect them — update it before writing any migration.

| Field | Type | Replaces / Notes |
|---|---|---|
| `display_name` | `text NOT NULL` | New — the invitation-facing name in Great Vibes overlay |
| `invitation_type` | `text NOT NULL` (`single`\|`couple`\|`family`) | New — replaces implicit "family unit" assumption |
| `invited_by` | `text NOT NULL` (`groom`\|`bride`) | New — auto-set at creation, never editable |
| `relationship_category` | `text NOT NULL` | Replaces old `relationship` field — enum expanded to 6 values |
| `sub_group` | `text` | New — optional custom label for seating grouping |

The `admin_users` table also requires a `role` column (`groom` | `bride`) for the two-admin
model — currently the prototype has a single seeded account with no role column.

---

*Document version: 1.0 | Created: 2026-08-29*
*Couple: Amandi Wijesundara & Tharindu Jayanetti | Wedding: Monday, 14 December 2026*
