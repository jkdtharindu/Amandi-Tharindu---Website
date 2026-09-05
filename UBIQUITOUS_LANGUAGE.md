# Ubiquitous Language

This document defines the canonical vocabulary for the Amandi & Tharindu wedding website project. Use these terms consistently in code, comments, tests, commit messages, and AI conversations. Do not introduce alternate names for the same concept.

## Core Terms

### Guest
- Canonical name: `Guest`
- Definition: A family unit invited to the wedding, identified by a unique invitation code and one RSVP record.
- Do not call it: `user`, `person`, `contact`, `member`
- Example: A guest record appears in the `guests` table and logs in with an invitation code.

### InvitationCode
- Canonical name: `InvitationCode`
- Definition: The unique access code printed on a physical wedding card that identifies a Guest.
- Do not call it: `token`, `password`, `passcode`, `access key`
- Example: `SILVA-001` is stored in the `guests.code` field and used for guest login.

### InvitationPage
- Canonical name: `InvitationPage`
- Definition: The personalized guest-facing page shown after a Guest successfully accesses the site.
- Do not call it: `landing page`, `dashboard`, `home screen`
- Example: The route `/invitation` renders the invitation experience for the authenticated guest.

### RSVP
- Canonical name: `RSVP`
- Definition: The guest’s response to the wedding invitation, either acceptance or decline.
- Do not call it: `response`, `submission`, `registration`, `confirm`
- Example: A Guest can submit an RSVP through the sticky bar or the invitation form.

### RSVPStatus
- Canonical name: `RSVPStatus`
- Definition: The current state of a Guest’s RSVP: pending, accepted, or declined.
- Do not call it: `state`, `status`, `outcome`
- Example: `guests.rsvp_status` is updated when a Guest changes their reply.

### RSVPResponse
- Canonical name: `RSVPResponse`
- Definition: The stored record of a Guest’s submitted RSVP details, including attendance choice and participant names.
- Do not call it: `entry`, `form`, `submission record`
- Example: The `rsvp_responses` table stores each accepted or declined response.

### Participant
- Canonical name: `Participant`
- Definition: A person attending the wedding on behalf of a Guest’s family unit.
- Do not call it: `guest`, `member`, `attendee` in the context of family RSVP details
- Example: A Guest with `slot_count = 4` can enter up to four participant names.
- Note (proposed 2026-09-03, not yet built): each Participant will also carry an `AgeCategory` and an optional `SeatingTable` assignment — see PRD §14 and `TASKS.md`.

### AgeCategory
- Canonical name: `AgeCategory`
- Definition: The generational classification (elder, adult, youth, or child) assigned to a Participant, captured at RSVP time and used for seating/table planning.
- Do not call it: `age group`, `age band`, `demographic`
- Example: Each Participant gets an AgeCategory when the Guest submits their RSVP. **Proposed 2026-09-03 — not yet built.**

### SlotCount
- Canonical name: `SlotCount`
- Definition: The maximum number of participants a Guest is allowed to include in their RSVP.
- Do not call it: `capacity`, `limit`, `seats`
- Example: The admin assigns a SlotCount per Guest when managing the guest list.

### RelationshipType
- Canonical name: `RelationshipType`
- Definition: The category used to group a Guest, such as Relations, Colleagues, Neighbours, or Friends.
- Do not call it: `group`, `category`, `tag`
- Example: The `guests.relationship` field stores the RelationshipType.

### Admin
- Canonical name: `Admin`
- Definition: The couple’s privileged account used to manage content, guests, messages, and site settings.
- Do not call it: `owner`, `staff`, `manager`, `editor`
- Example: The admin logs in through Supabase Auth and accesses `/admin/*` routes.

### CelebrationEvent
- Canonical name: `CelebrationEvent`
- Definition: A wedding-related event such as the ceremony or reception.
- Do not call it: `event`, `occasion`, `activity`
- Example: An event appears on the celebration page with a venue, time, and map link.

### StoryMilestone
- Canonical name: `StoryMilestone`
- Definition: A timeline entry describing a meaningful moment in the couple’s relationship.
- Do not call it: `story item`, `timeline entry`, `post`
- Example: The admin manages milestones in the story section.

### GalleryPhoto
- Canonical name: `GalleryPhoto`
- Definition: A photo displayed in the public gallery or story slideshow.
- Do not call it: `image`, `asset`, `media item`
- Example: A gallery photo is stored in the `gallery_photos` table.

### Wish
- Canonical name: `Wish`
- Definition: A written message left by a Guest for the couple.
- Do not call it: `comment`, `message`, `review`
- Example: A Wish is created by a Guest and approved by the Admin before being shown publicly.

### ThemeSettings
- Canonical name: `ThemeSettings`
- Definition: The global visual configuration for the website, including colors, fonts, hero image, and invitation overlay settings.
- Do not call it: `theme`, `config`, `design settings`
- Example: The `theme_settings` table stores the site-wide visual rules.

### ThemePalette
- Canonical name: `ThemePalette`
- Definition: A named, pre-approved set of colours (primary, background, accent, ink) that the Admin selects to set the site's visual identity in one action.
- Do not call it: `palette`, `colour scheme`, `skin`, `preset`, `swatch`
- Example: Selecting the `Chateau Green` ThemePalette restyles every page, the invitation, and the admin panel.
- Note: A ThemePalette is a *selection*, not a set of loose colour fields. Custom colours remain a secondary option; see PRD §4.1.

### FontChoice
- Canonical name: `FontChoice`
- Definition: A named pairing of a display face (headings) and a body face, selected by the Admin from a curated list.
- Do not call it: `font`, `typeface`, `font family`, `typography setting`
- Example: The `Playfair` FontChoice sets Playfair Display for headings and Inter for body text.
- Note: A FontChoice must ship an actual loadable font source. Naming a family without loading it silently falls back to a system font.

### InvitationTemplate
- Canonical name: `InvitationTemplate`
- Definition: The base invitation image and overlay configuration used to personalize guest invitations.
- Do not call it: `template`, `background`, `design file`
- Example: The admin uploads the InvitationTemplate in the theme editor.

### MessageTemplate
- Canonical name: `MessageTemplate`
- Definition: A reusable message format used for WhatsApp, SMS, or email outreach.
- Do not call it: `template`, `text`, `campaign`
- Example: The system uses MessageTemplates such as initial invite and reminder messages.

### MessageLog
- Canonical name: `MessageLog`
- Definition: A record of a message that was sent, failed, or is pending.
- Do not call it: `history`, `log entry`, `delivery record`
- Example: The `message_logs` table stores the sent status for each outreach attempt.

### SiteSection
- Canonical name: `SiteSection`
- Definition: A reusable content block that can be displayed on a public page.
- Do not call it: `section`, `component`, `widget`
- Example: A custom SiteSection can be added under the admin section manager.

### SeatingTable
- Canonical name: `SeatingTable`
- Definition: A physical table at the reception, with a name/number and a seat capacity, to which the Admin assigns Guests.
- Do not call it: `table` (ambiguous with database tables), `desk`, `group`, `seat group`
- Example: A SeatingTable named "Table 4" seats eight Guests, assigned by the Admin on `/admin/table-arrangement`.
- Note: Built 2026-09-04 (`seating_tables`/`table_seats`, migrations 007–008). Scoped down from the per-Participant, AgeCategory/RelationshipType-filtered vision proposed 2026-09-03 (see `Participant`'s note above and PRD §14) — the built version assigns whole Guests to seats, not individual Participants, and the admin UI has no AgeCategory or RelationshipType filter. Revisit if per-participant seating is still wanted; until then, `SeatAssignment` below still describes the unbuilt finer-grained version.

### SeatAssignment
- Canonical name: `SeatAssignment`
- Definition: The link between one Participant and one seat number at a SeatingTable.
- Do not call it: `booking`, `placement`, `allocation`, `chair`
- Example: A SeatAssignment places Nimal Silva at seat 3 of Table 4.
- Note: Planned for P2-06. The user-facing word may be "chair", but the code term is `SeatAssignment`.

### ProbableAttendee
- Canonical name: `ProbableAttendee`
- Definition: An anonymous placeholder seat-holder, created by the Admin as a buffer count against the Declined or Pending RSVPStatus bucket, representing one additional person who might attend despite that RSVPStatus. Carries no name and is never linked to any Guest record.
- Do not call it: `guest`, `walk-in`, `standby guest`, `waitlist guest`, `probable guest`
- Example: The Admin sets the Pending bucket's estimate to 3 on the Table Arrangement dashboard, creating three ProbableAttendee placeholders that can be assigned to open seats.
- Note: Proposed 2026-09-05 (Grill Me session) — not yet built. See PRD §16. Does not change `rsvp_status` on any Guest; it is a separate, aggregate-only construct for capacity planning.

### BalanceToArrange
- Canonical name: `BalanceToArrange`
- Definition: The count of RSVP-accepted Guests who have not yet been assigned a seat on a SeatingTable — Accepted count minus Table Arranged count.
- Do not call it: `unassigned count`, `remaining guests`, `unseated total`
- Example: The Table Arrangement dashboard's BalanceToArrange stat drops by one each time the Admin seats another accepted Guest.
- Note: Proposed 2026-09-05 (Grill Me session) — not yet built. See PRD §16. Counts confirmed Accepted Guests only; ProbableAttendee placeholders are tracked separately.

### RSVPCutoff
- Canonical name: `RSVPCutoff`
- Definition: The date after which Guests can no longer submit or change an RSVP, freezing the headcount for catering and seating.
- Do not call it: `deadline`, `lock date`, `freeze`, `closing date`
- Example: After the RSVPCutoff passes, the Invitation page shows the final response instead of a change option.
- Note: Planned for P2-07, pending the clarification recorded in the PRD.

---

## Forbidden Terms

The following generic terms are not acceptable in this project context. Replace them with the domain-specific terms above.

- `user` → `Guest`
- `person` → `Guest` or `Participant`
- `account` → `Guest` or `Admin`
- `contact` → `Guest`
- `item` → `GalleryPhoto`, `CelebrationEvent`, `SiteSection`, or `Wish`
- `entry` → `RSVPResponse`, `Wish`, or `MessageLog`
- `message` → `MessageTemplate` or `MessageLog` depending on context
- `post` → `Wish` or `StoryMilestone`
- `template` → `InvitationTemplate` or `MessageTemplate`
- `asset` → `GalleryPhoto` or `InvitationTemplate`
- `theme` → `ThemeSettings`
- `config` → `ThemeSettings` or `SiteSection`
- `palette` / `colour scheme` / `preset` → `ThemePalette`
- `font` / `typeface` / `font family` → `FontChoice`
- `table` → `SeatingTable` (reserve the bare word for database tables)
- `chair` / `seat` → `SeatAssignment`
- `deadline` / `lock date` → `RSVPCutoff`
- `walk-in` / `standby guest` / `waitlist guest` → `ProbableAttendee`

---

## Usage Rules

1. Prefer the canonical terms above over generic English alternatives.
2. Use `Guest` for the invited family unit, not `user`.
3. Use `RSVP` and `RSVPStatus` consistently when discussing the wedding response flow.
4. Use `Admin` for the couple’s privileged management account only.
5. When in doubt, choose the most specific domain term from this file rather than a generic synonym.
