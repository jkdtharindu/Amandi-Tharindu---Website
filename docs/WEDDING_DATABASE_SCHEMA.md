> Project: Amandi & Tharindu Wedding Website | Generated: 2026-08-29
> Table/column names use the exact terms from `WEDDING_UBIQUITOUS_LANGUAGE.md`.
> Do not confuse with `DATABASE_SCHEMA.md` — that file belongs to the Senhill Holiday Resort
> project. This is the wedding project's own schema file.

# Database Schema — Amandi & Tharindu Wedding Website

PostgreSQL via Supabase. All migrations live in `supabase/migrations/` (ordered, additive).
Migrations 001–003 have been written but **never applied to any database** as of 2026-08-29.

---

> **Drift note (2026-09-05):** This file was last fully updated 2026-08-29 and predates several
> shipped features. In particular, the "Out of Scope" section below still lists `seating_tables`
> as not-yet-built — it was built and merged 2026-09-04 (P1-14) and is documented properly further
> down. Treat table/column lists below as best-effort, not guaranteed current; cross-check against
> `migrations/*.sql` for anything schema-critical.

## Schema Delta vs. Original PRD (changes from Grill Me session, 2026-08-29)

The following are **new or changed** relative to PRD §7. All other tables are unchanged.
Apply these as a new migration (004) before writing Slice 10 code.

| Table | Change | Reason |
|---|---|---|
| `guests` | Add `display_name text NOT NULL` | Name rendered in Great Vibes on InvitationCard |
| `guests` | Add `invitation_type text NOT NULL` (`single`\|`couple`\|`family`) | Replaces implicit "family unit" assumption |
| `guests` | Add `invited_by text NOT NULL` (`groom`\|`bride`) | Two-admin model; gates WhatsApp confirmation routing |
| `guests` | Rename `relationship` → `relationship_category`; expand enum to 6 values | Canonical term changed; `invitees` added |
| `guests` | Add `sub_group text` (nullable) | Custom seating grouping label |
| `admin_users` | Add `role text NOT NULL` (`groom`\|`bride`) | Two-admin model; replaces single-account prototype |
| `theme_settings` | Add `palette_name text` | ThemePalette picker (PRD §4.1) |
| `theme_settings` | Add `font_choice text` | FontChoice picker (PRD §4.1) |
| `theme_settings` | Add `groom_whatsapp text` | Groom's number for WhatsAppConfirmationButton |
| `theme_settings` | Add `bride_whatsapp text` | Bride's number for WhatsAppConfirmationButton |

---

## `admin_users`

Two rows only — one per admin. Seeded via Supabase Auth migration.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Supabase Auth user id |
| `email` | text | UNIQUE NOT NULL | Login credential |
| `role` | text | NOT NULL | `groom` \| `bride` — determines GuestPartition access and WhatsApp routing |
| `display_name` | text | NOT NULL | Admin's name shown in the admin panel UI |
| `created_at` | timestamptz | DEFAULT now() | |

> **Prototype deviation (2026-08-29):** The prototype uses a single seeded account via
> `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` env vars with no `role` column. The full two-admin model
> requires Supabase Auth migration — this table definition is the target state.

---

## `guests`

One row per invited party (Single / Couple / Family). One row = one physical card = one
`InvitationCode`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `code` | text | UNIQUE NOT NULL | InvitationCode — format `SURNAME-NNN`, auto-generated, collision-checked |
| `display_name` | text | NOT NULL | Rendered in Great Vibes on InvitationCard — e.g. `"Mr. & Mrs. Perera"` |
| `invitation_type` | text | NOT NULL | `single` \| `couple` \| `family` |
| `invited_by` | text | NOT NULL | `groom` \| `bride` — auto-set at creation, never editable |
| `relationship_category` | text | NOT NULL | `family` \| `relations` \| `friends` \| `colleagues` \| `neighbours` \| `invitees` |
| `sub_group` | text | nullable | Custom label within category — e.g. `"School Friends"`, `"Perera Clan"` |
| `slot_count` | integer | NOT NULL | Max Participants in acceptance RSVP |
| `whatsapp_number` | text | nullable | Captured on first login (optional). Used for admin messaging. |
| `email` | text | nullable | Optional — used for email channel messaging |
| `has_visited` | boolean | DEFAULT false | Set true on first successful code login |
| `rsvp_status` | text | DEFAULT 'pending' | `pending` \| `accepted` \| `declined` |
| `is_deleted` | boolean | DEFAULT false | Soft delete — deleted guests cannot log in; RSVPResponse preserved |
| `created_at` | timestamptz | DEFAULT now() | |

> **Deprecated column (do not use):** The original PRD §7 had a `name` column and a
> `relationship` column (4-value enum). These are **replaced** by `display_name`,
> `invitation_type`, and `relationship_category` (6-value enum). Migration 004 should rename
> `relationship` → `relationship_category`, add the missing columns, and backfill where possible.

### InvitationCode generation rules

- Format: `SURNAME-NNN` (e.g. `SILVA-001`, `PERERA-012`)
- Surname extracted from `display_name` (last word, uppercased) at creation time
- Sequence (`NNN`): zero-padded 3-digit integer, incremented per surname prefix
- Must check for uniqueness in `guests.code` before persisting — no DB unique-constraint race

### GuestPartition enforcement

- `invited_by = 'groom'` → readable/editable only by `GroomAdmin`
- `invited_by = 'bride'` → readable/editable only by `BrideAdmin`
- `GroomAdmin` (super admin) may additionally read both partitions in aggregate views (dashboard, CSV export)
- Enforced at the Supabase RLS policy layer, not just application code

---

## `rsvp_responses`

One row per Guest (upsert on re-submission — not a history log).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `guest_id` | uuid | NOT NULL REFERENCES guests(id) | FK — one response per Guest |
| `attending` | boolean | NOT NULL | `true` = accepted, `false` = declined |
| `participant_names` | text[] | nullable | Array of names; length must not exceed `guests.slot_count` |
| `submitted_at` | timestamptz | DEFAULT now() | First submission time |
| `updated_at` | timestamptz | nullable | Set on every change after first submission |

> Upsert semantics: `INSERT ... ON CONFLICT (guest_id) DO UPDATE`. Previous values are
> overwritten — there is no RSVP history table. `updated_at` is the only change signal.

---

## `events`

Wedding ceremony, reception, and any other scheduled events. Admin-managed via `/admin/events`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `name` | text | NOT NULL | e.g. `"Wedding Ceremony"`, `"Reception"` |
| `event_date` | date | NOT NULL | |
| `event_time` | time | NOT NULL | Local Sri Lanka time |
| `venue_name` | text | NOT NULL | |
| `venue_address` | text | NOT NULL | |
| `google_maps_url` | text | nullable | Standard `https://maps.google.com/?q=` URL |
| `venue_image_url` | text | nullable | Supabase Storage URL |
| `icon` | text | nullable | Icon identifier for UI rendering |
| `display_order` | integer | DEFAULT 0 | Admin-controlled sort order |

---

## `story_milestones`

Couple's relationship timeline. Admin-managed via `/admin/story`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `title` | text | NOT NULL | e.g. `"First Met"`, `"He Proposed"` |
| `milestone_date` | date | nullable | Approximate dates acceptable |
| `description` | text | nullable | Short paragraph |
| `photo_url` | text | nullable | Supabase Storage URL |
| `display_order` | integer | DEFAULT 0 | |

---

## `childhood_photos`

Two carousels (Bride's / Groom's) on the Our Story page. Admin-managed via `/admin/story`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `person` | text | NOT NULL | `bride` \| `groom` |
| `photo_url` | text | NOT NULL | Supabase Storage URL |
| `caption` | text | nullable | |
| `display_order` | integer | DEFAULT 0 | |

---

## `gallery_photos`

Couple photos displayed on the Gallery page. Admin-managed via `/admin/gallery`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `photo_url` | text | NOT NULL | Supabase Storage URL |
| `caption` | text | nullable | |
| `display_order` | integer | DEFAULT 0 | |

---

## `wishes`

Guest-submitted wishes held for admin approval before public display.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `guest_id` | uuid | nullable REFERENCES guests(id) | nullable — a wish can outlive a soft-deleted guest |
| `guest_name` | text | NOT NULL | Denormalized from `guests.display_name` at submission time |
| `message` | text | NOT NULL | |
| `is_approved` | boolean | DEFAULT false | Only approved wishes render on the public Wishes page |
| `created_at` | timestamptz | DEFAULT now() | |

---

## `message_templates`

Pre-seeded at first deploy. Admin can edit body text — not the `name` or `channel`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `name` | text | NOT NULL | `initial_invite` \| `reminder_1` \| `reminder_2` \| `thank_you` |
| `body` | text | NOT NULL | Supports placeholders: `[Name]` `[Code]` `[Link]` `[Date]` `[Venue]` |
| `channel` | text | NOT NULL | `whatsapp` \| `sms` \| `email` |

> **HITL gate:** Any feature that sends real messages to guests via Twilio or Resend requires
> explicit owner approval before the send capability is activated. See `HITL_NOTES_WEDDING.md`.

---

## `message_logs`

One row per send attempt to one Guest via one channel.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `guest_id` | uuid | NOT NULL REFERENCES guests(id) | |
| `template_id` | uuid | nullable REFERENCES message_templates(id) | nullable — direct sends may not use a template |
| `channel` | text | NOT NULL | `whatsapp` \| `sms` \| `email` |
| `sent_at` | timestamptz | nullable | Set on success; null if still pending/failed |
| `status` | text | NOT NULL DEFAULT 'pending' | `sent` \| `failed` \| `pending` |
| `error_message` | text | nullable | Provider error on failure |

---

## `theme_settings`

Single row — global site configuration. Upsert on save.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | Single row |
| `palette_name` | text | nullable | ThemePalette name — e.g. `"Modern Royal Romance"`. Null = custom hex |
| `font_choice` | text | nullable | FontChoice pairing name — e.g. `"Cormorant + Montserrat"` |
| `primary_color` | text | DEFAULT '#4A1525' | CSS custom property `--color-primary` |
| `secondary_color` | text | DEFAULT '#FBF9F5' | CSS custom property `--color-background` |
| `accent_color` | text | DEFAULT '#866D3D' | CSS custom property `--color-accent` |
| `surface_color` | text | DEFAULT '#E6E1DC' | CSS custom property `--color-surface` |
| `font_family` | text | DEFAULT 'Cormorant Garamond' | Heading/display font |
| `body_font_family` | text | DEFAULT 'Montserrat' | Body/UI font |
| `hero_image_url` | text | nullable | Supabase Storage URL — PreLoginScreen background |
| `invitation_template_url` | text | nullable | Supabase Storage URL — 1080×1520px portrait JPG/PNG |
| `invitation_name_top` | text | DEFAULT '45%' | NameOverlay CSS top% |
| `invitation_name_left` | text | DEFAULT '50%' | NameOverlay CSS left% |
| `invitation_name_font_size` | text | DEFAULT '2rem' | NameOverlay font size |
| `invitation_name_color` | text | DEFAULT '#4A1525' | NameOverlay colour |
| `couple_names` | text | DEFAULT 'Amandi & Tharindu' | Rendered in PreLoginScreen typography |
| `wedding_date` | date | DEFAULT '2026-12-14' | Used in countdown and messaging placeholders |
| `venue_name` | text | nullable | Primary venue name |
| `venue_address` | text | nullable | Primary venue address |
| `groom_whatsapp` | text | nullable | Groom's WhatsApp number for WhatsAppConfirmationButton |
| `bride_whatsapp` | text | nullable | Bride's WhatsApp number for WhatsAppConfirmationButton |
| `custom_css` | text | nullable | Advanced — escape hatch for one-off overrides |

> **Colour defaults updated (2026-08-29):** Original PRD defaults (`#B8860B`, `#FFF8DC`,
> `#8B0000`) are replaced with the "Modern Royal Romance" palette values. The original gold
> `#B8860B` failed WCAG AA and must not be reinstated.

---

## `site_sections`

Custom content blocks per public page. Admin-managed via `/admin/sections`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `page` | text | NOT NULL | `home` \| `our-story` \| `celebration` \| `gallery` \| `wishes` |
| `section_type` | text | NOT NULL | `text` \| `image` \| `gallery` \| `custom` |
| `title` | text | nullable | |
| `content` | text | nullable | |
| `display_order` | integer | DEFAULT 0 | |
| `is_visible` | boolean | DEFAULT true | Only visible sections render on the public page |

---

## `seating_tables`

A physical table at the reception (see `SeatingTable` in `UBIQUITOUS_LANGUAGE.md`). Built and
applied live 2026-09-04 (P1-14, migration 007) — **not present in this doc until 2026-09-05**,
added retroactively to close the drift noted at the top of this file.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `table_number` | integer | NOT NULL UNIQUE | |
| `table_name` | text | nullable | e.g. `"Family"`, `"VIP"` |
| `capacity` | integer | NOT NULL DEFAULT 10 | Number of seats — currently means Guest *parties*, not headcount (see `SeatingTable` note in `UBIQUITOUS_LANGUAGE.md`) |
| `created_at` | timestamptz | DEFAULT now() | |
| `updated_at` | timestamptz | DEFAULT now() | |

## `table_seats`

One row per seat at a SeatingTable. A seat holds at most one Guest (see `SeatAssignment`, though
the shipped version links a whole Guest, not a Participant — planned refinement is P2-06).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `seating_table_id` | uuid | NOT NULL REFERENCES seating_tables(id) ON DELETE CASCADE | |
| `seat_number` | integer | NOT NULL, UNIQUE with `seating_table_id` | |
| `guest_id` | uuid | nullable REFERENCES guests(id) ON DELETE SET NULL | A Guest occupies at most one seat — enforced by a partial unique index, not app logic |
| `dietary_requirements` | text | nullable | |
| `special_notes` | text | nullable | |
| `created_at` | timestamptz | DEFAULT now() | |
| `updated_at` | timestamptz | DEFAULT now() | |

> **Proposed addition (2026-09-05, not yet built — PRD §16):** a nullable `probable_attendee_id`
> column, mutually exclusive with `guest_id` via a CHECK constraint, so a seat can alternatively
> hold a `ProbableAttendee` placeholder. See `probable_attendees` below and PRD §16 for the full
> migration (010).

## `probable_attendees` (Proposed 2026-09-05 — not yet built, PRD §16)

Anonymous seat-holder placeholders representing the Admin's buffer estimate of Guests who might
attend despite a Declined or Pending RSVPStatus. See `ProbableAttendee` in
`UBIQUITOUS_LANGUAGE.md`. Never linked to a real `guests` row and never changes `rsvp_status`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | |
| `rsvp_bucket` | text | NOT NULL CHECK IN ('declined', 'pending') | Which RSVP bucket this buffer slot belongs to |
| `slot_index` | integer | NOT NULL, UNIQUE with `rsvp_bucket` | Display ordering — "Probable (Declined) #1", "#2", ... |
| `created_at` | timestamptz | DEFAULT now() | |

> HITL required before applying migration 010 to any database, per standing project policy —
> this table and the `table_seats.probable_attendee_id` column are additive-only.

## Relationships

```
admin_users 1---* guests (invited_by → admin_users.role, enforced via RLS)

guests 1---1 rsvp_responses (one response per guest, upsert)
guests 1---* message_logs
guests 1---* wishes

message_templates 1---* message_logs
```

---

## Derived Values (not stored — computed at query time)

**RSVP headcount:** Total confirmed Participants = `SUM(array_length(participant_names, 1))` across
all `rsvp_responses` where `attending = true`. Not stored — computed in the dashboard query.

**GuestPartition totals:** Dashboard shows accepted/declined/pending broken down by
`guests.invited_by` — computed by grouping, not stored.

---

## Out of Scope — Do Not Add These Tables Yet

Confirmed P2 / Chapter 2 — no tables, columns, or migrations for these during Chapter 1:

- ~~`seating_tables` / `seat_assignments` — P2 seating plan~~ — **built and live 2026-09-04** as
  `seating_tables`/`table_seats` (whole-Guest, not per-Participant — see documentation above).
  Struck through rather than removed so this doesn't silently look like it was never planned.
- Per-Participant seating (`participants` table, `AgeCategory`/`RelationshipType` filtering) — the
  original P1-14 vision in PRD §14, scoped down to whole-Guest seating for the shipped version.
  Still P2 if per-Participant seating is wanted later (tracked as `SeatAssignment`, P2-06).
- `qr_boarding_passes` — P2 digital boarding pass
- `tenants` / `couple_accounts` — Chapter 2 multi-tenancy

---

## Migration Files (target state)

| File | Status | Contents |
|---|---|---|
| `001_create_guests_rsvp.sql` | Written, never applied | `guests`, `rsvp_responses` |
| `002_create_content_tables.sql` | Written, never applied | `events`, `story_milestones`, `childhood_photos`, `gallery_photos`, `wishes` |
| `003_create_admin_theme_sections.sql` | Written, never applied | `admin_users`, `theme_settings`, `site_sections` |
| `004_create_messaging.sql` | Not yet written | `message_templates`, `message_logs` |
| `005_guest_model_update.sql` | Not yet written | Add `display_name`, `invitation_type`, `invited_by`, `sub_group`; rename `relationship` → `relationship_category`; add `role` to `admin_users`; add `palette_name`, `font_choice`, `groom_whatsapp`, `bride_whatsapp` to `theme_settings` |
| `007_create_table_arrangements.sql` | Written and applied live (2026-09-04) | `seating_tables`, `table_seats` — see documentation above. Note: this doc's original 001–005 plan above never actually shipped as written; the live `migrations/` directory took its own numbering (001 `guests`, 002 `rsvp_responses`, 003 `admin_theme_sections`, 004 `theme_palette_font_choice`, 005 `messaging`, 006 `invitation_code_format`, 007 `table_arrangements`, 008 `fix_couple_name_order`, 009 `celebration_events`). Cross-check `migrations/*.sql` directly rather than this table for exact history. |
| `010_create_probable_attendees.sql` | Proposed 2026-09-05, not yet written | `probable_attendees` table, `table_seats.probable_attendee_id` column — see documentation above and PRD §16 |

> Migration 005 must be written and reviewed before Slice 10 (Guest Management) begins.
> It touches the `guests` table directly — HITL approval required before applying to any
> database. See `HITL_NOTES_WEDDING.md`.
> Migration 010 (ProbableAttendee, PRD §16) is additive-only but still requires HITL approval
> before applying to any database, per standing project policy.

---

*Document version: 1.0 | Created: 2026-08-29*
*Couple: Amandi Wijesundara & Tharindu Jayanetti | Wedding: Monday, 14 December 2026*
