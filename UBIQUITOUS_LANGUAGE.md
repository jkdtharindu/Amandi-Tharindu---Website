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
- Definition: A physical table at the reception, with a name/number and a seat capacity, to which Participants are assigned.
- Do not call it: `table` (ambiguous with database tables), `desk`, `group`
- Example: A SeatingTable named "Table 4" seats eight Participants.
- Note: Planned for P2-06. Never use the bare word `table` in code for this concept — it collides with database terminology.

### SeatAssignment
- Canonical name: `SeatAssignment`
- Definition: The link between one Participant and one seat number at a SeatingTable.
- Do not call it: `booking`, `placement`, `allocation`, `chair`
- Example: A SeatAssignment places Nimal Silva at seat 3 of Table 4.
- Note: Planned for P2-06. The user-facing word may be "chair", but the code term is `SeatAssignment`.

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
- `table` → `SeatingTable` (reserve the bare word for database tables)
- `chair` / `seat` → `SeatAssignment`
- `deadline` / `lock date` → `RSVPCutoff`

---

## Usage Rules

1. Prefer the canonical terms above over generic English alternatives.
2. Use `Guest` for the invited family unit, not `user`.
3. Use `RSVP` and `RSVPStatus` consistently when discussing the wedding response flow.
4. Use `Admin` for the couple’s privileged management account only.
5. When in doubt, choose the most specific domain term from this file rather than a generic synonym.
