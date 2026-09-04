> Source: pasted by the project owner on 2026-08-28. Saved verbatim below.
> Status: its colour palette was **approved as the sixth `ThemePalette`** ("Modern Royal Romance")
> in `amandi-tharindu-wedding-PRD.md` §4.1 on 2026-08-28, with the gold accent darkened to clear
> WCAG AA (see the reconciliation note at the bottom). The picker/cascade feature itself is not
> yet built (still open in `TASKS.md`), and the fonts + extra product surfaces (QR pass, seating
> visualizer, admin floor-plan canvas) described below remain unreconciled — see the note.

# Modern Royal Romance: Wedding Website & Guest Portal UI/UX Design Specification

## Project Overview & Design Philosophy
This UI/UX specification translates the **Modern Royal Romance** hall design brief into a digital platform (Web & Mobile). The digital experience mirrors a high-end fashion magazine and five-star luxury hospitality brand (e.g., Aman, Rosewood), seamlessly integrating with the physical hotel venue's rich burgundy carpet, beige draping, warm lighting, and antique gold details.

---

## 1. Design System & Tokens

### Color Palette
*   **Primary Background / Base:** `#FBF9F5` (Deep cream / soft ivory - linen and paper feel)
*   **Deep Contrast (Text & Key Accents):** `#4A1525` (Rich wine / burgundy - matching hall carpet & floral accents)
*   **Secondary Metallic Accent:** `#C5A059` (Muted antique gold - lines, borders, active states)
*   **Soft Support Surface:** `#E6E1DC` (Warm taupe / beige - cards & section dividers)
*   **Muted Foliage Accent:** `#768670` (Soft sage green for subtle status chips)

### Typography Stack & Custom Font Selection
The platform features an editorial luxury typographic hierarchy. Users/Admins can configure or preview custom fonts adhering to these strict characteristic profiles:

*   **Headings (Editorial Serif):**
    *   *Characteristics:* High contrast, elegant serif, luxury editorial feel, modern interpretation of classic typography.
    *   *Recommended System Fallbacks / Options:* `Cormorant Garamond`, `Playfair Display`, `Cinzel`, `Bodoni Moda`.
*   **Body & UI Copy (Contemporary Sans-Serif):**
    *   *Characteristics:* Clean geometric sans-serif, excellent mobile readability, professional minimal appearance.
    *   *Recommended System Fallbacks / Options:* `Montserrat`, `Inter`, `Plus Jakarta Sans`.

---

## 2. Public Website Architecture & Wireframes

### Navigation Bar
*   **Layout:** Fixed top, translucent ivory (`#FBF9F5` with 95% opacity), subtle 1px antique gold bottom border (`#C5A059`).
*   **Elements:** Left-aligned Monogram/Logo (`A & D`), center-aligned links (`Story`, `Events`, `Gallery`, `RSVP`, `FAQ`), right-aligned *Portal Login* button.

### Hero Section
*   **Visuals:** Cinematic background image (ivory & champagne tones with soft burgundy vignette) with a subtle dark overlay (20% opacity) to ensure high text contrast.
*   **Content:**
    *   Eyebrow: *The Wedding Celebration of*
    *   Heading (Cormorant Garamond, 48px): **Amelia & Daniel**
    *   Sub-heading: Modern Royal Romance • December 14, 2026 • Colombo, Sri Lanka
    *   Countdown Timer: Minimalist capsule boxes in warm taupe (`#E6E1DC`) with antique gold numbers.
    *   Primary CTA: Solid burgundy button (`#4A1525`) with white text -> *Explore RSVP*.

### Story & Timeline
*   **Layout:** Vertical editorial timeline with alternating image cards and text blocks.
*   **Styling:** Ivory cards framed by 1px antique gold borders, generous whitespace.

### Event Information & Venue Guide
*   **Layout:** Dual-column card grid detailing Ceremony (The Grand Ballroom) and Reception (Banquet Hall).
*   **Interactive Element:** Embedded custom map styled to match the warm ivory/burgundy palette.

---

## 3. Secure Guest Portal & Seating Experience

Accessed via unique secure tokens (`wedding.com/invite/code-8842`).

### Personalized Welcome Screen
*   Greeting customized dynamically: *"Welcome, Dr. and Mrs. Perera. We have reserved 2 seats in your honor at Table 4 (The Grand Burgundy)."*

### Digital Invitation Pass (QR Pass)
*   **Design:** Modeled after a first-class luxury boarding pass.
*   **Features:** Minimalist gold foil border (`#C5A059`), guest name, table assignment, dietary badge, and high-contrast scannable QR code for frictionless entry check-in.

### Interactive Seating Visualizer
*   Zoomable overhead map of the banquet hall layout, highlighting the user's assigned table relative to the ivory-and-gold stage.

---

## 4. Admin Seating Management Dashboard

### Features & Capabilities
*   **Visual Floor Plan Canvas:** Drag-and-drop interface mapping round tables (capacity 8–10) mirroring physical banquet hall dimensions.
*   **Conflict Detection Logic:** Real-time warning banners for over-capacity tables, unconfirmed RSVPs, or seating clashes.
*   **Export Tools:** One-click generation of print-ready PDF seating charts and Excel reports for hotel banquet catering staff.

---

## 5. UI Component Specifications & States

| Component | CSS / Styling Specification | Interaction State |
|---|---|---|
| **Primary Buttons** | Background: `#4A1525`, Color: `#FBF9F5`, Padding: 14px 28px, Border: none, Radius: 2px. | Hover: Background `#38101C`, Border-color `#C5A059`, transition 0.3s ease. |
| **Input Fields** | Background: transparent, Border-bottom: 1px solid `#C5A059`, Padding: 10px 4px, Font: Inter 14px. | Focus: Border-color `#4A1525`, outline none. Floating label transitions smoothly. |
| **Information Cards** | Background: `#FBF9F5`, Border: 1px solid #E6E1DC, Box-shadow: 0 4px 20px rgba(74,21,37,0.04), Padding: 32px. | Hover: Subtle translateY(-2px) lift with 0.4s ease. |

---

## 6. Accessibility & Responsiveness
*   **Contrast Ratio:** All text combinations (especially `#4A1525` on `#FBF9F5`) meet WCAG AAA standards for high readability.
*   **Mobile-First Scaling:** Touch targets minimum 48x48px; layout collapses seamlessly from 3-column desktop grids to single-column mobile viewports.

---

## Reconciliation note (added by Claude, 2026-08-28; updated same day on owner approval)

This brief was pasted by the owner as a standalone document. Its colour palette has now been
reconciled with the project's `ThemePalette` system; the rest has not.

1. **PRD §4.1 (2026-08-23) requires colours to come from a curated `ThemePalette` picker, not raw
   hex entry.** This brief was written entirely in raw hex, so it was added as a **sixth approved
   palette** — "Modern Royal Romance" — in PRD §4.1's table, alongside Chateau Green, Imperial
   Gold, Rose Blush, Midnight Silver, and Terracotta, rather than shipped as a one-off hardcoded
   theme.
2. **Verified against `src/theme/colors.js`'s `contrastRatio()` (the project's existing WCAG gate)
   on 2026-08-28:**
   - `#4A1525` ink on `#FBF9F5` background: **14.01:1** — passes AAA, matches the brief's own claim.
   - `#FBF9F5` button text on `#4A1525` button: **14.01:1** — passes.
   - `#4A1525` ink on `#E6E1DC` taupe surface: **11.34:1** — passes.
   - **`#C5A059` antique gold on `#FBF9F5` background originally measured 2.34:1 — failed WCAG AA
     (needs 4.5:1 for text).** The brief specifies "antique gold numbers" for the countdown timer
     and gold as a general accent; as literal text colour that combination was not accessible.
     **Approved fix (2026-08-28): darkened proportionally (same RGB channel ratios, scaled to 68%
     of original value — the same technique used to take Imperial Gold from `#B8860B` to
     `#8A6508`) to `#866D3D`, which measures 4.68:1 against `#FBF9F5`.** This is the value now in
     the PRD §4.1 "Approved palettes" table; `#C5A059` (the brief's original) is not used anywhere.
   - `#768670` sage on `#FBF9F5`: 3.69:1 — fails the 4.5:1 text bar, passes only the 3:1 bar for
     large text/UI components (fine for "status chips" as stated, not for body copy). Not part of
     the approved palette's four core tokens (Primary/Background/Accent/Ink); usable as a
     decorative chip colour only, same restriction as originally noted.
3. **Still open — not yet reconciled:** fonts named (`Bodoni Moda`, `Montserrat`,
   `Plus Jakarta Sans`) are not yet in the PRD §4.1 font-pairing candidate list, and PRD §4.1 flags
   that **webfonts are not currently loaded at all** — no `<link>`, `@font-face`, or font file
   exists, so any of these would silently fall back to Georgia until that is fixed. The
   `ThemePalette`/`FontChoice` picker UI itself is also still unbuilt (open items in `TASKS.md`);
   this palette is documentation only until that ships.
4. **Still open — beyond current scope:** this brief also specifies concrete product surfaces
   beyond current scope — a digital boarding-pass-style QR invitation pass, an interactive seating
   visualizer for guests, and an admin drag-and-drop floor-plan canvas with PDF/Excel export.
   These overlap with `TASKS.md`'s P2-06 (seating plan) but go further (QR check-in, floor-plan
   canvas) than what's currently scoped there. Needs an owner decision before any of it is built.

See [`amandi-tharindu-wedding-PRD.md`](amandi-tharindu-wedding-PRD.md) §4.1 and
[`TASKS.md`](TASKS.md) for the corresponding entries.
