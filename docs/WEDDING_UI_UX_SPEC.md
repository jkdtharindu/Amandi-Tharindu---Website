# Wedding Website — UI/UX Specification
## Amandi & Tharindu | Modern Royal Romance

> **For AI agents:** This file is the single source of truth for all visual, interaction, and
> animation decisions. Read alongside `amandi-tharindu-wedding-PRD.md` (scope) and
> `UBIQUITOUS_LANGUAGE.md` (domain terms). When PRD and this file conflict on a UI detail,
> this file wins. When PRD and this file conflict on scope or data model, the PRD wins.
>
> **Source:** Consolidated from `WEDDING_UI_UX_DESIGN_BRIEF.md` (owner-pasted 2026-08-28)
> and a Grill Me session (2026-08-29). Every decision below was owner-confirmed.

---

## 1. Design Philosophy

**"Modern Royal Romance"** — a luxury hospitality aesthetic that mirrors the physical venue:
rich burgundy carpet, beige draping, warm lighting, antique gold details. The digital
experience references a high-end fashion magazine and a five-star hotel (think Aman,
Rosewood) — never a generic wedding template.

Three principles carry through every screen:
1. **Motion serves content** — animations are subtle and purposeful, never decorative for
   their own sake. Nothing bounces or spins.
2. **Emotion before information** — the guest's first experience is cinematic, not functional.
   The code entry, the envelope opening, the invitation reveal — these are moments, not steps.
3. **Mobile is the primary platform** — Sri Lankan guests are overwhelmingly on mid-range
   Android phones. Every layout decision starts at 320px.

---

## 2. Design Tokens

### Colour Palette — "Modern Royal Romance" (Palette 6, PRD §4.1)

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#4A1525` | Buttons, headings, key accents, ink on light surfaces |
| `--color-background` | `#FBF9F5` | Page background, cards — deep cream / soft ivory |
| `--color-accent` | `#866D3D` | Lines, borders, active states, countdown numbers — antique gold (darkened from `#C5A059` to pass WCAG AA: 4.68:1 against background) |
| `--color-surface` | `#E6E1DC` | Cards, section dividers — warm taupe / beige |
| `--color-ink` | `#4A1525` | Body text (same as primary — 14.01:1 against background, passes AAA) |
| `--color-sage` | `#768670` | Decorative status chips only — 3.69:1, not for body copy |

> `#C5A059` (original brief gold) must never be used as text — it measures 2.34:1 against
> the background, which fails WCAG AA. Use `#866D3D` everywhere instead.

### Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Headings / Display | Cormorant Garamond | 400, 600 | Self-hosted. High contrast, classical editorial. |
| Body / UI copy | Montserrat | 400, 500, 600 | Self-hosted. Clean geometric sans, excellent mobile readability. |
| Name overlay on invitation | Great Vibes | 400 | Self-hosted. Cursive/script — "වැල් අකුරු" style. Used only for the guest name rendered on the invitation template. |

> **Critical:** All three fonts must be self-hosted (no Google Fonts CDN dependency). Sri Lanka
> connectivity cannot depend on a third-party CDN being reachable at the moment a guest opens
> their invitation. Use `@font-face` with locally served `.woff2` files.
>
> **Current state (2026-08-29):** Webfonts are not loaded at all — the prototype names font
> families but nothing is fetched, so every screen silently falls back to Georgia/system-ui.
> Fixing this is a prerequisite for any UI work on Next.js.

### Spacing & Radius

- Base unit: `8px`
- Card padding: `32px` desktop, `20px` mobile
- Button padding: `14px 28px`
- Border radius: `2px` (near-square — luxury, not playful)
- Touch targets: minimum `48×48px` (all interactive elements on mobile)

---

## 3. Animation Philosophy

**Default animation spec** (applies site-wide unless overridden per component below):

| Property | Value |
|---|---|
| Page transition | Soft fade, 250ms ease |
| Card hover lift | `translateY(-2px)`, 400ms ease |
| Sticky RSVP bar entry | Slide up from below, 300ms ease |
| Button hover | Background darkens (`#4A1525` → `#38101C`), border-color `#866D3D`, 300ms ease |
| Input focus | Border-bottom transitions from `#866D3D` to `#4A1525`, floating label smoothly repositions |
| Countdown flip | Smooth number tick, no jarring snap |

Nothing bounces. Nothing spins. No parallax on scroll (performance risk on mid-range Android).

---

## 4. Site States

The site has two distinct states based on whether the guest has a valid session.

### State 1 — Pre-login (Unauthenticated)

**What the guest sees:** A single full-screen cinematic landing page. Nothing else is
accessible — no navigation, no public pages, no content.

**Layout:**
- Full-screen hero: background image (admin-uploaded, ivory/champagne tones, warm lighting)
  with a subtle dark overlay (20% opacity) for text contrast
- Center-aligned, vertically centered:
  - Couple names in **Cormorant Garamond**, large (48px desktop / 36px mobile)
  - Animated in: slow fade-in, ~1.2s ease, staggered (Amandi fades first, then `&`, then Tharindu)
  - A thin antique gold (`#866D3D`) divider line draws across beneath the names (~0.6s ease, left to right)
  - Below the divider: a single input field fades in (~0.4s delay after divider completes)
  - Input label: *"Enter your invitation code"* in Montserrat
  - Placeholder: styled in Great Vibes as a hint (e.g. *"SILVA-001"*)
  - Submit button: solid burgundy, white text, `2px` radius
- **No countdown** on this screen. No navigation. No footer.

**Error state:** Invalid code shows an inline message below the input field: *"We couldn't
find your invitation. Please check the code on your card."* Input border transitions to a
soft error state. No page reload.

### State 2 — Post-login (Authenticated)

Full site unlocked: navigation, all public pages, sticky RSVP bar, invitation page.
Navigation links: Home · Our Story · The Celebration · Gallery · Wishes · (Invitation — if not already RSVPed)

---

## 5. Navigation Bar (Post-login)

- Fixed top, translucent ivory (`#FBF9F5`, 95% opacity), 1px antique gold bottom border
- Left: monogram / logo ("A & T" in Cinzel or Cormorant Garamond)
- Center: page links in Montserrat 500
- Right: guest's display name (small, Montserrat 400) — confirms who is logged in
- Mobile: hamburger menu, full-screen overlay on open, links stacked vertically with generous touch targets

---

## 6. Invitation Page — Envelope Animation & Name Overlay

This is the most important screen. Every detail below is a confirmed decision.

### Envelope Animation Sequence

1. Guest logs in with valid code → brief loading state (500ms max)
2. A sealed envelope graphic appears center-screen, scaled to fill ~80% of viewport width
3. Envelope is styled in the Modern Royal Romance palette — ivory body (`#FBF9F5`), antique gold border (`#866D3D`), burgundy wax seal graphic on the flap
4. Flap lifts open: CSS transform, ~0.8s ease-in-out
5. Invitation card slides up out of the envelope: translateY animation, ~0.6s ease
6. Envelope fades away, invitation card scales to fill the viewport
7. Total animation: ~2s from login to invitation visible

**Fallback:** If no template image is uploaded by admin, the invitation renders as a styled HTML/CSS card using the Modern Royal Romance palette — ivory background, burgundy border, couple names, date, venue — in the same envelope animation flow.

### Name Overlay

- Font: **Great Vibes**, self-hosted `.woff2`
- Text: pulled from `guests.display_name` — admin-entered exactly as it should appear:
  - Single: `"Mr. Nimal Silva"`
  - Couple: `"Mr. & Mrs. Perera"`
  - Family: `"The Silva Family"`
- Position: absolutely positioned over the template image, configurable by admin via `/admin/theme` (top%, left%, font size, colour)
- Default colour: `#4A1525` (burgundy) — admin can change
- All display_name values are HTML-escaped before rendering

### RSVP Inline Reveal (below the invitation card)

After the envelope animation completes, the sticky RSVP bar appears (if not yet RSVPed).
Tapping Accept on either the bar or the invitation page:
- A form section **expands inline below the invitation card** (max-height animation, ~300ms ease)
- Form fields: participant count selector, participant name inputs, WhatsApp number (if not yet captured)
- Participant count capped at `slot_count` — frontend enforces, backend validates
- Submit → inline confirmation message replaces the form
- WhatsApp confirmation button appears: **"Inform us on WhatsApp 💬"**

### WhatsApp Confirmation Button

- Appears only after a successful acceptance submission
- Routes to the correct admin WhatsApp number based on `guests.invited_by`:
  - `invited_by = 'groom'` → Groom's WhatsApp number (configured in admin panel)
  - `invited_by = 'bride'` → Bride's WhatsApp number (configured in admin panel)
- Opens `https://wa.me/[number]?text=[pre-filled message]`
- Pre-filled message: *"Hi, I have confirmed my RSVP for Amandi & Tharindu's wedding. [display_name] — [invitation_code]."*
- Button style: WhatsApp green background, white text, WhatsApp icon left-aligned

---

## 7. Guest List Data Model (UI implications)

Each guest record has these admin-entered fields that drive UI rendering:

| Field | Type | UI Impact |
|---|---|---|
| `display_name` | text | Rendered in Great Vibes on invitation template |
| `invitation_type` | enum: Single / Couple / Family | Shown in guest list; affects slot_count defaults |
| `invited_by` | enum: Groom / Bride | Auto-locked to logged-in admin; routes WhatsApp confirmation |
| `relationship_category` | enum: Family / Relations / Friends / Colleagues / Neighbours / Invitees | Filter in guest list; used for seating grouping (P2) |
| `sub_group` | text | Custom label within category — e.g. "School Friends", "Office Team", a family clan name. Shown in guest list; used for seating grouping (P2) |
| `slot_count` | integer | Caps participant count in RSVP form |
| `whatsapp_number` | text | Pre-fills WhatsApp field in RSVP form |
| `invitation_code` | text | Auto-generated `SURNAME-001` format |

**CSV import format** (for bulk guest entry):
```
display_name, invitation_type, relationship_category, sub_group, slot_count, whatsapp_number
"Mr. & Mrs. Perera", Couple, Relations, Perera Clan, 2, +94771234567
"The Silva Family", Family, Family, Silva Clan, 4, +94779876543
"Mr. Nimal Fernando", Single, Friends, School Friends, 1, +94712345678
```

---

## 8. Component Specifications

| Component | Spec | Interaction |
|---|---|---|
| Primary Button | Background `#4A1525`, text `#FBF9F5`, padding `14px 28px`, radius `2px` | Hover: bg `#38101C`, border-color `#866D3D`, 300ms ease |
| Secondary Button | Background transparent, border `1px solid #866D3D`, text `#4A1525` | Hover: bg `#E6E1DC`, 300ms ease |
| Input Field | Background transparent, border-bottom `1px solid #866D3D`, padding `10px 4px`, Montserrat 14px | Focus: border-color `#4A1525`, floating label transitions |
| Information Card | Background `#FBF9F5`, border `1px solid #E6E1DC`, shadow `0 4px 20px rgba(74,21,37,0.04)`, padding `32px` | Hover: `translateY(-2px)`, 400ms ease |
| Status Chip | Background `#E6E1DC`, text `#768670` (sage — large text only, passes 3:1), Montserrat 12px 500 | Static — no interaction |
| Sticky RSVP Bar | Background `#4A1525`, text `#FBF9F5`, fixed bottom, full width, padding `12px 20px` | Slides up on first appearance, 300ms ease |

---

## 9. Accessibility Requirements (WCAG 2.1 AA minimum, AAA where noted)

- All text on `#FBF9F5` background: use `#4A1525` ink — 14.01:1 (AAA) ✅
- All text on `#E6E1DC` surface: use `#4A1525` ink — 11.34:1 (AAA) ✅
- Gold accent (`#866D3D`) as text: 4.68:1 against `#FBF9F5` — passes AA ✅
- Sage (`#768670`) as text: 3.69:1 — **large text / UI components only** (status chips, icons), never body copy
- All interactive elements: minimum `48×48px` touch target
- Keyboard navigation: full tab order on all forms and navigation
- Alt text: required on all images (template image, gallery, story photos)
- Focus indicators: visible on all interactive elements (do not remove outline)
- RSVP form: all fields labelled (not placeholder-only)

---

## 10. Responsive Breakpoints

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile S | 320px | Primary design target — Sri Lankan Android phones |
| Mobile L | 480px | Larger Android phones |
| Tablet | 768px | Two-column layout begins |
| Desktop | 1024px | Full nav, side-by-side content |
| Wide | 1440px | Max content width, centred |

Mobile-first: all CSS starts at 320px, desktop styles added via `min-width` media queries.

---

## 11. P2 — Deferred UI Features (Post-Launch, do not build now)

These were discussed in the design brief and confirmed as P2 (post-launch) in the Grill Me session. Documented here so architectural decisions don't accidentally foreclose them.

| Feature | Brief Description | Dependency |
|---|---|---|
| Digital QR Boarding Pass | Luxury boarding-pass styled card (Great Vibes name, table number, dietary badge, scannable QR for venue check-in) | Requires table assignment (P2 seating) |
| Interactive Seating Visualizer (guest-facing) | Overhead map of banquet hall, guest's assigned table highlighted | Requires table assignment (P2 seating) |
| Admin Drag-and-Drop Floor Plan Canvas | Visual table arrangement, conflict detection, PDF/Excel export for catering staff | Requires confirmed RSVP data + table model |
| Sub-group seating logic | Group guests by `sub_group` label when assigning tables (e.g. "School Friends" at one table) | Requires P2 seating feature |

None of these are to be built during Chapter 1.

---

## 12. Admin Panel Visual Style

The admin panel uses the same design tokens as the guest-facing site — it should feel like the same product, not a generic grey dashboard. The couple uses the admin panel on both desktop and mobile.

- Same colour palette, fonts, and component styles
- Tables: ivory background, antique gold column borders, Montserrat 14px
- Forms: same floating-label input style as guest-facing
- Status indicators: RSVP status chips using the sage/taupe/burgundy palette
- Navigation: left sidebar on desktop, bottom tab bar on mobile

---

*Document version: 1.0 | Created: 2026-08-29 | Based on: WEDDING_UI_UX_DESIGN_BRIEF.md (2026-08-28) + Grill Me session (2026-08-29)*
*Couple: Amandi Wijesundara & Tharindu Jayanetti | Wedding: Monday, 14 December 2026*
