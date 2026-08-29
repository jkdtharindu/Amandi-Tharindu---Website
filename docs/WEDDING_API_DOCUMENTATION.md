> Project: Amandi & Tharindu Wedding Website | Generated: 2026-08-29
> All field names use canonical terms from `WEDDING_UBIQUITOUS_LANGUAGE.md`.
> Do not confuse with `API_DOCUMENTATION.md` — that file belongs to the Senhill Holiday Resort.
> Stack: Next.js 14 App Router route handlers (`app/api/`) + Supabase Auth sessions.

# API Documentation — Amandi & Tharindu Wedding Website

---

## Conventions

### Base URL
All API routes are under `/api/`. In the prototype: `http://localhost:3000/api/`.
In production: `https://[custom-domain]/api/`.

### Authentication — two session types

**Guest session** (`guest_session` cookie):
- Created by `POST /api/guest/login` with a valid `InvitationCode`
- HTTP-only signed cookie; scoped to the guest's own record
- Required on all `/api/guest/*` routes
- A guest session cannot read another guest's data

**Admin session** (`admin_session` cookie):
- Created by `POST /api/admin/auth/login`
- HTTP-only signed cookie; scoped to the admin's role (`groom` | `bride`)
- Required on all `/api/admin/*` routes
- `GroomAdmin` can read across both `GuestPartition`s in aggregate views; `BrideAdmin` is restricted to her own partition for mutations

### CSRF protection
All state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid CSRF token:
- Fetch the token via `GET /api/csrf-token` → `{ csrfToken: "..." }`
- Send as header: `X-CSRF-Token: <token>`
- Requests missing the header return `403 Forbidden`

### Standard error shape
```json
{
  "success": false,
  "reason": "machine_readable_key",
  "message": "Human-friendly explanation shown to the user."
}
```

### Standard success shape
```json
{
  "success": true,
  "data": { ... }
}
```

### HTTP status codes used
| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Bad request — validation error |
| `401` | Unauthenticated — no valid session |
| `403` | Forbidden — wrong session type, wrong partition, or missing CSRF |
| `404` | Not found |
| `409` | Conflict — e.g. duplicate code |
| `422` | Unprocessable — business rule violation (e.g. slot count exceeded) |
| `500` | Internal server error |

---

## CSRF

### `GET /api/csrf-token`
Returns a CSRF token for the current session. Call before any mutating request.

**Auth:** None required.

**Response 200:**
```json
{ "csrfToken": "abc123xyz" }
```

---

## Guest Auth

### `POST /api/guest/login`
Authenticates a guest by `InvitationCode`. Creates a `GuestSession` cookie on success.
Code-only — name-based login is explicitly not supported (removed 2026-08-29).

**Auth:** None (this is the login endpoint).
**CSRF:** Required.

**Request body:**
```json
{ "code": "SILVA-001" }
```

**Response 200 — valid code:**
```json
{
  "success": true,
  "data": {
    "guestId": "uuid",
    "displayName": "Mr. & Mrs. Perera",
    "invitationType": "couple",
    "rsvpStatus": "pending",
    "slotCount": 2,
    "hasVisited": false
  }
}
```

**Response 401 — invalid or soft-deleted code:**
```json
{
  "success": false,
  "reason": "invalid_code",
  "message": "We couldn't find your invitation. Please check the code on your card."
}
```

**Notes:**
- Sets an HTTP-only `guest_session` cookie on success
- Updates `guests.has_visited = true` on first successful login
- Soft-deleted guests (`is_deleted = true`) return `401 invalid_code` — same error as an unknown code; do not reveal that a record exists

---

### `POST /api/guest/logout`
Clears the `GuestSession` cookie.

**Auth:** None required — see idempotency note below.
**CSRF:** Required.

**Response 200:**
```json
{ "success": true }
```

**Response 403 — missing or mismatched CSRF token:**
```json
{
  "success": false,
  "reason": "csrf_invalid",
  "message": "Invalid CSRF token."
}
```

**Notes:**
- Deliberately **idempotent**: signing out with no session (or twice) returns `200`, not an
  error. A guest whose cookie has already expired should get a clean result when they tap
  "Sign out", not a confusing failure.
- Clears only `guest_session`. An admin session in the same browser is untouched.
- Surfaced on the Invitation page as "Signed in as *name* — Not you? Sign out". This matters
  on a shared family phone: once `/invitation/:code` began requiring a session (Slice 18),
  there was otherwise no way to hand the device to the next guest.

---

### `GET /api/guest/me`
Returns the current guest's record. Used to hydrate the UI after page load.

**Auth:** Guest session required — returns `401` if no valid session.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "guestId": "uuid",
    "displayName": "Mr. & Mrs. Perera",
    "invitationType": "couple",
    "rsvpStatus": "pending",
    "slotCount": 2,
    "hasVisited": true,
    "whatsappNumber": "+94771234567",
    "tableNumber": null
  }
}
```

---

## RSVP

### `POST /api/guest/rsvp`
Submits or updates an RSVP for the current guest. Upserts `rsvp_responses`.

**Auth:** Guest session required.
**CSRF:** Required.

**Request body — accept:**
```json
{
  "attending": true,
  "participantNames": ["Nimal Perera", "Kamala Perera"],
  "whatsappNumber": "+94771234567"
}
```

**Request body — decline:**
```json
{
  "attending": false
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "rsvpStatus": "accepted",
    "attending": true,
    "participantNames": ["Nimal Perera", "Kamala Perera"],
    "updatedAt": "2026-08-29T10:00:00Z"
  }
}
```

**Response 422 — slot count exceeded:**
```json
{
  "success": false,
  "reason": "slot_count_exceeded",
  "message": "You can register a maximum of 2 participants."
}
```

**Response 401 — no guest session:**
```json
{
  "success": false,
  "reason": "not_authenticated",
  "message": "Please sign in to respond."
}
```

**Response 403 — code does not match the session:**
```json
{
  "success": false,
  "reason": "not_your_invitation",
  "message": "You can only respond to your own invitation."
}
```

**Notes:**
- The `guest_session` cookie — not the posted `code` — determines whose RSVP this is.
  The `code` is still required, but only to confirm the client is answering for the guest
  it is signed in as; a mismatch is a `403`, never a write. (Implemented in Slice 18;
  before that, any caller who knew a code could overwrite that family's response.)
- `participantNames` array length must not exceed `guests.slot_count` — validated server-side
- `whatsappNumber` is optional; if provided, stored to `guests.whatsapp_number`
- `whatsappNumber` ignored on subsequent calls if already set (captured on first visit only)
- Previous `rsvp_responses` row is updated (upsert on `guest_id`) — not duplicated
- `guests.rsvp_status` updated to `accepted` or `declined` accordingly

---

## Wishes

### `POST /api/guest/wishes`
Submits a wish from the current guest. Held for admin approval — not publicly visible until approved.

**Auth:** Guest session required.
**CSRF:** Required.

**Request body:**
```json
{ "message": "Wishing you a lifetime of happiness!" }
```

**Response 201:**
```json
{
  "success": true,
  "data": { "wishId": "uuid", "isApproved": false }
}
```

---

## Admin Auth

### `POST /api/admin/auth/login`
Authenticates an admin via Supabase Auth (email + password).

**Auth:** None.
**CSRF:** Required.

**Request body:**
```json
{ "email": "tharindu@example.com", "password": "..." }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "adminId": "uuid",
    "displayName": "Tharindu Jayanetti",
    "role": "groom"
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "reason": "invalid_credentials",
  "message": "Incorrect email or password."
}
```

**Notes:**
- Sets an HTTP-only `admin_session` cookie
- `role` in the response is `groom` | `bride` — drives UI and partition access client-side

---

### `POST /api/admin/auth/logout`
Clears the admin session.

**Auth:** Admin session.
**CSRF:** Required.

**Response 200:**
```json
{ "success": true }
```

---

## Admin — Guest Management (Slice 10)

All routes below require an admin session. `BrideAdmin` can only read/mutate guests in her own
`GuestPartition` (`invited_by = 'bride'`). `GroomAdmin` can read both partitions in list/aggregate
views but can only mutate his own partition's records.

---

### `GET /api/admin/guests`
Returns the paginated guest list for the logged-in admin's partition (or both for GroomAdmin).

**Auth:** Admin session.

**Query parameters:**
| Param | Type | Default | Notes |
|---|---|---|---|
| `partition` | `groom` \| `bride` \| `all` | own partition | `all` available to GroomAdmin only |
| `rsvpStatus` | `pending` \| `accepted` \| `declined` \| `all` | `all` | Filter by RSVPStatus |
| `relationshipCategory` | enum or `all` | `all` | Filter by RelationshipCategory |
| `subGroup` | string | — | Exact match filter on SubGroup |
| `search` | string | — | Searches `display_name` and `code` (case-insensitive, partial match) |
| `page` | integer | `1` | |
| `pageSize` | integer | `50` | Max `200` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "guests": [
      {
        "guestId": "uuid",
        "code": "SILVA-001",
        "displayName": "Mr. & Mrs. Silva",
        "invitationType": "couple",
        "invitedBy": "groom",
        "relationshipCategory": "relations",
        "subGroup": "Perera Clan",
        "slotCount": 2,
        "whatsappNumber": "+94771234567",
        "email": null,
        "rsvpStatus": "accepted",
        "participantNames": ["Nimal Silva", "Kamala Silva"],
        "hasVisited": true,
        "isDeleted": false,
        "createdAt": "2026-08-29T08:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "totalCount": 184,
      "totalPages": 4
    }
  }
}
```

---

### `POST /api/admin/guests`
Creates a new guest record. Auto-generates a unique `InvitationCode`.

**Auth:** Admin session.
**CSRF:** Required.

**Request body:**
```json
{
  "displayName": "Mr. & Mrs. Perera",
  "invitationType": "couple",
  "relationshipCategory": "relations",
  "subGroup": "Perera Clan",
  "slotCount": 2,
  "whatsappNumber": "+94771234567",
  "email": null
}
```

**Field rules:**
| Field | Required | Notes |
|---|---|---|
| `displayName` | ✅ | Non-empty string. Exactly as it should appear on the InvitationCard in Great Vibes font. |
| `invitationType` | ✅ | `single` \| `couple` \| `family` |
| `relationshipCategory` | ✅ | `family` \| `relations` \| `friends` \| `colleagues` \| `neighbours` \| `invitees` |
| `subGroup` | ❌ | Optional free text |
| `slotCount` | ✅ | Integer ≥ 1. Suggested defaults: `single`→1, `couple`→2, `family`→admin-entered |
| `whatsappNumber` | ❌ | Optional. E.164 format recommended (`+94...`) |
| `email` | ❌ | Optional |

**`invitedBy` is NOT in the request body** — it is set server-side from the logged-in admin's role.

**InvitationCode generation (server-side):**
1. Extract surname: last word of `displayName`, uppercased, non-alpha chars stripped
2. Find the highest existing sequence for that surname prefix in `guests.code`
3. Increment and zero-pad to 3 digits: `PERERA-001`, `PERERA-002`, etc.
4. Verify uniqueness before insert — retry on collision (max 5 attempts)

**Response 201:**
```json
{
  "success": true,
  "data": {
    "guestId": "uuid",
    "code": "PERERA-001",
    "displayName": "Mr. & Mrs. Perera",
    "invitationType": "couple",
    "invitedBy": "groom",
    "relationshipCategory": "relations",
    "subGroup": "Perera Clan",
    "slotCount": 2,
    "rsvpStatus": "pending",
    "createdAt": "2026-08-29T08:00:00Z"
  }
}
```

**Response 400 — validation error:**
```json
{
  "success": false,
  "reason": "validation_error",
  "message": "displayName is required.",
  "fields": { "displayName": "This field is required." }
}
```

---

### `GET /api/admin/guests/:guestId`
Returns a single guest record with full RSVP detail.

**Auth:** Admin session. Returns `403` if the guest belongs to the other admin's partition (BrideAdmin requesting a Groom guest).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "guestId": "uuid",
    "code": "SILVA-001",
    "displayName": "The Silva Family",
    "invitationType": "family",
    "invitedBy": "bride",
    "relationshipCategory": "family",
    "subGroup": "Silva Clan",
    "slotCount": 4,
    "whatsappNumber": "+94779876543",
    "email": "silva@example.com",
    "rsvpStatus": "accepted",
    "rsvpResponse": {
      "attending": true,
      "participantNames": ["Nimal Silva", "Kamala Silva", "Dinesh Silva", "Ravi Silva"],
      "submittedAt": "2026-08-20T14:00:00Z",
      "updatedAt": null
    },
    "hasVisited": true,
    "isDeleted": false,
    "createdAt": "2026-08-10T08:00:00Z"
  }
}
```

---

### `PATCH /api/admin/guests/:guestId`
Updates editable fields on a guest record. Partial update — only send fields to change.

**Auth:** Admin session. Returns `403` if the guest belongs to the other admin's partition.
**CSRF:** Required.

**Request body (all fields optional):**
```json
{
  "displayName": "The Silva Family",
  "invitationType": "family",
  "relationshipCategory": "family",
  "subGroup": "Silva Clan",
  "slotCount": 4,
  "whatsappNumber": "+94779876543",
  "email": "silva@example.com"
}
```

**Not editable via this endpoint:** `code`, `invitedBy`, `rsvpStatus`, `isDeleted` (use the delete endpoint).

**Response 200:**
```json
{
  "success": true,
  "data": { "guestId": "uuid", "updatedFields": ["displayName", "slotCount"] }
}
```

**Response 422 — slot count below existing participant count:**
```json
{
  "success": false,
  "reason": "slot_count_below_rsvp",
  "message": "Cannot reduce slot count below the number of participants already registered (4)."
}
```

---

### `DELETE /api/admin/guests/:guestId`
Soft-deletes a guest. Sets `is_deleted = true`. Guest can no longer log in. `RSVPResponse` data is preserved.

**Auth:** Admin session. Returns `403` if the guest belongs to the other admin's partition.
**CSRF:** Required.

**⚠️ HITL note:** Soft-deleting a guest who has already RSVPed affects headcount. This is not reversible via the UI (no undelete). Consider confirming in the admin UI before calling this endpoint.

**Response 200:**
```json
{
  "success": true,
  "data": { "guestId": "uuid", "isDeleted": true }
}
```

---

### `POST /api/admin/guests/import`
Bulk-imports guests from a CSV upload. Validates each row; reports per-row errors without aborting the whole batch.

**Auth:** Admin session.
**CSRF:** Required.

**Request:** `multipart/form-data` with a single `file` field (`.csv`).

**CSV format:**
```
display_name,invitation_type,relationship_category,sub_group,slot_count,whatsapp_number,email
"Mr. & Mrs. Perera",couple,relations,Perera Clan,2,+94771234567,
"The Silva Family",family,family,Silva Clan,4,+94779876543,silva@example.com
"Mr. Nimal Fernando",single,friends,School Friends,1,+94712345678,
```

- `invited_by` is set server-side from the logged-in admin's role (same as single-create)
- `email` and `whatsapp_number` are optional — leave empty, do not omit the column
- Rows with `display_name` or `slot_count` missing are rejected
- Duplicate `display_name` within the batch is allowed (generates different codes)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "imported": 47,
    "failed": 2,
    "errors": [
      { "row": 12, "reason": "missing_display_name", "message": "Row 12: display_name is required." },
      { "row": 31, "reason": "invalid_invitation_type", "message": "Row 31: invitation_type must be single, couple, or family." }
    ]
  }
}
```

---

## Admin — RSVP Dashboard (Slice 11, not yet built)

### `GET /api/admin/dashboard`
Returns real-time RSVP stats across both partitions (GroomAdmin) or own partition (BrideAdmin).

**Auth:** Admin session.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "totalInvited": 350,
      "accepted": 187,
      "declined": 43,
      "pending": 120,
      "headcount": 412
    },
    "byPartition": {
      "groom": { "totalInvited": 180, "accepted": 95, "declined": 22, "pending": 63, "headcount": 210 },
      "bride": { "totalInvited": 170, "accepted": 92, "declined": 21, "pending": 57, "headcount": 202 }
    },
    "byRelationshipCategory": {
      "family":     { "invited": 40, "accepted": 38, "declined": 1, "pending": 1 },
      "relations":  { "invited": 80, "accepted": 55, "declined": 12, "pending": 13 },
      "friends":    { "invited": 90, "accepted": 48, "declined": 18, "pending": 24 },
      "colleagues": { "invited": 60, "accepted": 28, "declined": 8, "pending": 24 },
      "neighbours": { "invited": 40, "accepted": 12, "declined": 3, "pending": 25 },
      "invitees":   { "invited": 40, "accepted": 6, "declined": 1, "pending": 33 }
    }
  }
}
```

### `GET /api/admin/dashboard/export`
Downloads the full guest list as CSV (all columns including RSVP details and participant names).

**Auth:** Admin session.
**Response:** `text/csv` attachment — `Content-Disposition: attachment; filename="rsvp-export-2026-08-29.csv"`

---

## Admin — Theme Settings

### `GET /api/admin/theme`
Returns current `ThemeSettings`.

**Auth:** Admin session.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "paletteName": "Modern Royal Romance",
    "fontChoice": "Cormorant + Montserrat",
    "primaryColor": "#4A1525",
    "backgroundColor": "#FBF9F5",
    "accentColor": "#866D3D",
    "surfaceColor": "#E6E1DC",
    "fontFamily": "Cormorant Garamond",
    "bodyFontFamily": "Montserrat",
    "heroImageUrl": null,
    "invitationTemplateUrl": null,
    "invitationNameTop": "45%",
    "invitationNameLeft": "50%",
    "invitationNameFontSize": "2rem",
    "invitationNameColor": "#4A1525",
    "coupleNames": "Amandi & Tharindu",
    "weddingDate": "2026-12-14",
    "venueName": null,
    "venueAddress": null,
    "groomWhatsapp": null,
    "brideWhatsapp": null
  }
}
```

### `PATCH /api/admin/theme`
Updates one or more `ThemeSettings` fields. Partial update.

**Auth:** Admin session.
**CSRF:** Required.

**Validation rules:**
- Hex colour fields must match `/^#[0-9A-Fa-f]{6}$/`
- `paletteName` must be a recognised palette name or `null` (custom)
- `weddingDate` must be a valid ISO date string
- All colour values are run through the WCAG contrast gate server-side before saving — any primary/accent colour that fails AA against its background surface is rejected with `422`

**Response 200:**
```json
{ "success": true, "data": { "updatedFields": ["paletteName", "groomWhatsapp"] } }
```

**Response 422 — contrast failure:**
```json
{
  "success": false,
  "reason": "contrast_failure",
  "message": "The selected primary colour (#C5A059) fails WCAG AA against the background. Minimum ratio required: 4.5:1. Measured: 2.34:1."
}
```

---

## Admin — Section Manager

### `GET /api/admin/sections`
Returns all `SiteSections`, optionally filtered by page.

**Auth:** Admin session.

**Query params:** `?page=home` (optional)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "sections": [
      {
        "sectionId": "uuid",
        "page": "home",
        "sectionType": "text",
        "title": "A note from us",
        "content": "We are so grateful...",
        "displayOrder": 1,
        "isVisible": true
      }
    ]
  }
}
```

### `POST /api/admin/sections`
Creates a new `SiteSection`.

**Auth:** Admin session.
**CSRF:** Required.

**Request body:**
```json
{
  "page": "home",
  "sectionType": "text",
  "title": "A note from us",
  "content": "We are so grateful...",
  "displayOrder": 1,
  "isVisible": true
}
```

**Response 201:**
```json
{ "success": true, "data": { "sectionId": "uuid" } }
```

### `PATCH /api/admin/sections/:sectionId`
Updates a `SiteSection`. Partial update.

**Auth:** Admin session.
**CSRF:** Required.

### `DELETE /api/admin/sections/:sectionId`
Permanently deletes a `SiteSection` (hard delete — sections have no guest data, safe to remove).

**Auth:** Admin session.
**CSRF:** Required.

**Response 200:**
```json
{ "success": true }
```

---

## Admin — Messaging Center (Slice 12, not yet built)

Documented here for planning. **HITL approval required before any send capability is activated.**

### `GET /api/admin/messages/templates`
Returns all `MessageTemplates`.

### `PATCH /api/admin/messages/templates/:templateId`
Updates a template's body text. `name` and `channel` are not editable.

### `POST /api/admin/messages/send`
Sends a message to a guest group via a selected channel.

**⚠️ HITL gate:** This endpoint must not go live without explicit owner approval per `HITL_NOTES_WEDDING.md`. Implement with a `sandboxMode` flag that logs sends without calling Twilio/Resend until the flag is disabled by the owner.

**Request body:**
```json
{
  "templateId": "uuid",
  "channel": "whatsapp",
  "recipientFilter": {
    "rsvpStatus": "pending",
    "invitedBy": "groom"
  },
  "sandboxMode": true
}
```

### `GET /api/admin/messages/logs`
Returns `MessageLog` entries, most recent first. Filterable by `status` and `guestId`.

### `POST /api/admin/messages/logs/:logId/retry`
Retries a failed `MessageLog` send.
**⚠️ HITL gate:** Same as `/send`.

---

## Prototype vs. Next.js — Current API State

The prototype (`src/server.js`) implements these routes in Express. The shapes below are the
**target Next.js shapes** — the prototype may differ slightly in field naming or structure.
When porting to Next.js, use this document (not the prototype code) as the authority.

| Route | Prototype status | Next.js status |
|---|---|---|
| `POST /api/guest/login` | ✅ Implemented (code + name) | ⬜ Port — **code only**, drop name path |
| `POST /api/guest/logout` | ✅ Implemented | ⬜ Port |
| `GET /api/guest/me` | ⚠️ Implicit (session cookie read) | ⬜ Explicit endpoint needed |
| `POST /api/guest/rsvp` | ✅ Implemented | ⬜ Port |
| `POST /api/guest/wishes` | ⚠️ Not implemented | ⬜ Build |
| `GET /api/csrf-token` | ✅ Implemented | ⬜ Port |
| `POST /api/admin/auth/login` | ✅ Implemented (single account) | ⬜ Port — two accounts via Supabase Auth |
| `POST /api/admin/auth/logout` | ✅ Implemented | ⬜ Port |
| `GET /api/admin/theme` | ✅ Implemented | ⬜ Port |
| `PATCH /api/admin/theme` | ✅ Implemented | ⬜ Port |
| `GET /api/admin/sections` | ✅ Implemented | ⬜ Port |
| `POST /api/admin/sections` | ✅ Implemented | ⬜ Port |
| `PATCH /api/admin/sections/:id` | ✅ Implemented | ⬜ Port |
| `DELETE /api/admin/sections/:id` | ✅ Implemented | ⬜ Port |
| `GET /api/admin/guests` | ❌ Not built | ⬜ Build (Slice 10) |
| `POST /api/admin/guests` | ❌ Not built | ⬜ Build (Slice 10) |
| `GET /api/admin/guests/:id` | ❌ Not built | ⬜ Build (Slice 10) |
| `PATCH /api/admin/guests/:id` | ❌ Not built | ⬜ Build (Slice 10) |
| `DELETE /api/admin/guests/:id` | ❌ Not built | ⬜ Build (Slice 10) |
| `POST /api/admin/guests/import` | ❌ Not built | ⬜ Build (Slice 10) |
| `GET /api/admin/dashboard` | ❌ Not built | ⬜ Build (Slice 11) |
| `GET /api/admin/dashboard/export` | ❌ Not built | ⬜ Build (Slice 11) |
| `GET /api/admin/messages/templates` | ❌ Not built | ⬜ Build (Slice 12, HITL) |
| `PATCH /api/admin/messages/templates/:id` | ❌ Not built | ⬜ Build (Slice 12, HITL) |
| `POST /api/admin/messages/send` | ❌ Not built | ⬜ Build (Slice 12, HITL) |
| `GET /api/admin/messages/logs` | ❌ Not built | ⬜ Build (Slice 12, HITL) |
| `POST /api/admin/messages/logs/:id/retry` | ❌ Not built | ⬜ Build (Slice 12, HITL) |

---

*Document version: 1.0 | Created: 2026-08-29*
*Couple: Amandi Wijesundara & Tharindu Jayanetti | Wedding: Monday, 14 December 2026*
