# User Guide Playbook

**Read this whenever the owner asks for a user guide, manual, how-to, or instructions for the admin (or a guest) — as a PDF or any other format.**

This file is the standard. Every guide must follow it, so every guide looks and works the same. The first guide built to this standard is the Message Center guide: `docs/MESSAGE_CENTER_GUIDE.pdf`, with its source in `docs/message-center-guide/`. Open it and copy its layout.

Why this exists: this website is going to be sold to other customers. Each customer's admin will open the site for the first time and need clear, safe guidance. A guide that is vague, out of date, or shows made-up screens is worse than no guide.

---

## The non-negotiable rules

1. **Use real screenshots of the real website.** Run the actual code and capture the actual screens. Never draw mock-ups, never paste screenshots from another site, never describe a screen you have not seen.
2. **Use sample data only.** Never put real guest names, phone numbers, codes, emails, or passwords in a screenshot or example. Use a local demo database with made-up guests. Say on the cover that the guests are samples.
3. **Check every claim against the code.** Old docs go stale (the first `docs/ADMIN_USER_MANUAL.md` WhatsApp section was wrong). Read the components and API routes for the feature. Write what the code does, not what an old document says.
4. **Say plainly what is not built.** If a customer will expect something the site cannot do, put it in a clearly marked "Not built yet · developer work needed" box. Give the manual workaround and describe the future fix. Never hide a gap.
5. **Do not claim what you did not test.** If something (for example, WhatsApp on a real phone) could not be tested, say so to the owner in the final message and recommend one quick test.
6. **Plain English.** Follow `CLAUDE.md` Communication Style. Short sentences. Lead with what to do. Explain any technical word in one line.
7. **Show the dangerous mistakes.** Every task that can go wrong in a way a guest would notice (wrong name, wrong message, code leaked) gets a red caution box, placed *before* the step where it can happen.

---

## What every guide must contain

Build the guide from the page types in `docs/user-guide-kit/guide-template.html`. Use these, in this order, and drop the ones that do not apply:

| Page type | What it holds |
|---|---|
| **Cover** | Title, one-line promise, who it is for, and "screenshots use sample guests". Use the customer's own names. |
| **Start here** | The 3 big ideas, in three cards. What the reader needs before they begin (device, login, settings). |
| **The plan** | The overall flow, the order of steps, and *why* the order matters. A small picture or diagram where it helps. |
| **Screen tour** | One real, annotated screenshot of the main page. A numbered key under it. A table that explains any status line or label. |
| **Task pages** | One page per task. A 3-step "do this loop" strip, the real screenshot with numbered markers, a numbered key, then a caution box. |
| **Special cases** | Anything that differs: families, shared codes, missing data, exceptions. Each gets its own steps and cautions. |
| **Not built yet** | The gap box and the manual workaround, with a printable tracker if the work is repetitive. |
| **Help** | A "If something goes wrong" table (problem → what to do). |
| **Golden rules** | 5–7 numbered rules. The mistakes that matter most. |

Every task page answers four questions in this order: **What am I doing? What do I press? How do I know it worked? What can go wrong?**

---

## Look and feel (so every guide matches)

Use the CSS in `guide-template.html` unchanged. Summary:

- **A4 pages**, 15 mm margins, Inter for text, a serif for headings, emoji font enabled.
- **Colors:** deep green for headings and the cover, rose red for numbered markers and warnings, gold for notes and "not built" boxes, mint for good-news boxes. For a new customer, change only the CSS color variables at the top (`--green`, `--green2`, `--rose`, `--gold`) and the cover text. Keep the structure.
- **Level cards** use one distinct color each (green, purple, gold, orange).
- **Boxes:** `.good` (mint, what works), `.note` (gold, remember), `.warn` (rose, danger), `.dev` (dashed gold, not built yet).
- **Screenshots** have a rounded border and a soft shadow, with a short caption under them.
- **Numbered markers** are red circles with a white number. The same number appears in the key under the picture.
- A heading must never sit alone at the bottom of a page, and a box must never split across pages.

---

## How to build a guide (the exact recipe)

### 1. Learn the feature from the code first

- Find the page: `app/admin/<page>/page.tsx` and its components in `components/admin/`.
- Find the API routes: `app/api/admin/...`.
- Find the rules: `src/**` (for messaging: `src/messaging/`, `src/admin/messageTemplates.js`).
- Read the labels and button text exactly as written. The guide must use the same words as the screen.
- Check `SHARED_STATE.md` and `HITL.md` for what the feature may and may not do.
- Look at the database table columns (`migrations/`) to confirm what is and is not stored. (Example: invitees have a name but no phone number. That is why "shared code, separate phones" is a gap.)

### 2. Run the real site locally with demo data

Tested on this repo (39 migrations, Postgres 16, port 5439 so it does not clash with anything).

```bash
# 0. Dependencies
npm install --no-audit --no-fund

# 1. A throwaway Postgres. The data folder must NOT be inside the scratchpad or /tmp:
#    the postgres user cannot read those folders and initdb fails.
PGB=/usr/lib/postgresql/16/bin; D=/var/lib/postgresql/demo16
mkdir -p $D && chown postgres $D
su postgres -c "$PGB/initdb -D $D -A trust && $PGB/pg_ctl -D $D -o '-p 5439 -k /var/lib/postgresql' -l /var/lib/postgresql/demo.log start"
psql -h /var/lib/postgresql -p 5439 -U postgres -c "create database wedding"

# 2. Demo admin logins (the password is only for this throwaway database)
H=$(echo demo-pass-123 | node scripts/set-admin-password.js | grep -o '[0-9a-f]\{32\}:[0-9a-f]\{128\}' | head -1)
cat > .env.local <<EOF
NODE_ENV=development
SESSION_SECRET=demo-secret-for-local-screenshots-only-0123456789
DATABASE_URL=postgresql://postgres@127.0.0.1:5439/wedding
NEXT_PUBLIC_SITE_URL=https://your-site.example
BRIDE_EMAIL=bride@demo.local
BRIDE_PASSWORD_HASH=$H
GROOM_EMAIL=groom@demo.local
GROOM_PASSWORD_HASH=$H
EOF
# .env.local is gitignored. Check with: git check-ignore .env.local   Never commit it.

# 3. Load the env, migrate, seed
#    (the migrate script only reads .env, not .env.local, so export the variables first)
set -a && . ./.env.local && set +a
npm run migrate
psql -h /var/lib/postgresql -p 5439 -U postgres wedding -f docs/user-guide-kit/seed-demo.sql

# 4. Start the site (same shell, so it has the env)
npm run dev        # http://localhost:3010
```

`docs/user-guide-kit/seed-demo.sql` creates 7 made-up guests: a family with 3 people, a couple, a 4-person family, guests with and without WhatsApp numbers, two tables, some seats, and some message ticks. **Extend the seed for each new guide** so the screen shows the situation you are explaining (for example, add a "waiting for a table" guest, or a declined guest). Keep names obviously fake.

The site expects `NEXT_PUBLIC_SITE_URL`. Use a clearly fake address (`https://your-site.example`) so no real link appears in a screenshot.

### 3. Capture annotated screenshots

Use Playwright (it is pre-installed in the cloud environment; `require('playwright')` works from any folder).

- `docs/user-guide-kit/example-capture-messages.js` is a full working example. Copy it and change the pages and selectors. Run: `mkdir -p <out>/shots && node capture.js <out>`.
- Log in through the real login form (`input[type=email]`, `input[type=password]`, submit), then go to the page. Never write a session cookie by hand.
- **Resolution:** viewport 1280×900, `deviceScaleFactor: 2` (sharp in print).
- **Hide the Next.js dev badge** before every shot: `nextjs-portal,[data-nextjs-toast]{display:none!important}`.
- **Numbered markers:** the `mark()` helper in the example drops a red numbered circle next to an element. Modes: `tl` (top-left corner), `r` (just right of it), `l` (just left of it), `in` (inside, at the right end). Pick the mode that does not cover any text. Look at every screenshot after you take it.
- **Cropping:** `page.screenshot({clip, fullPage:true})` uses *page* coordinates. If the page is scrolled, add `scrollY` to the element's box. The `box()` helper does this.
- **Phone check:** also load the page at 390 px wide (`isMobile:true`) and read `document.documentElement.scrollWidth`. If it is wider than 390 the page needs sideways scrolling — tell the reader, and tell the owner.
- Use `locator.evaluate(...)` for the markers. Playwright text selectors like `button:has-text("...")` do not work inside `document.querySelectorAll`.

Save the final images in `docs/<topic>-guide/images/` with numbered names (`01-overview.png`, `02-...`).

### 4. Write the guide as HTML

- Copy `docs/user-guide-kit/guide-template.html` to `docs/<topic>-guide/guide.html`.
- Keep `<img src="images/...">` relative so the PDF can be rebuilt.
- Replace the text. Keep the classes. Keep the markers' numbers matched with the key.
- Name the page for the *task* ("Sending to each guest"), not the code.

### 5. Render the PDF

```bash
node docs/user-guide-kit/render-pdf.js "$PWD/docs/<topic>-guide/guide.html" "$PWD/docs/<TOPIC>_GUIDE.pdf"
pdfinfo docs/<TOPIC>_GUIDE.pdf | grep Pages
```

### 6. Check it like a reader (do not skip)

- Make a picture of every page (`pdftoppm -r 60 -png`) and look at them all, ideally as one contact sheet.
- **Look for:** pages with only one box on them (content spilled over), headings alone at the bottom of a page, markers covering text, emoji showing as "�", text running off the edge, screenshots that are blurry or cropped wrongly.
- Fix by tightening the layout (smaller screenshot width: class `figure.s` 76%, `figure.m` 70%; shorter text; a forced page break before a heading with `break-before:page`). Re-render and look again.
- Zoom into one full page at ~80 dpi and read it as the reader would.

### 7. Also write a text version

Keep `docs/<TOPIC>_GUIDE.md` as the plain-text twin of the PDF (no screenshots needed). Same sections, same wording. It is what gets searched, diffed and reviewed.

### 8. Clean up, then deliver

- Stop the dev server and the demo Postgres (`pkill -f "next dev"`; `pg_ctl ... stop`). Do not leave them running.
- Make sure `.env.local` is not staged (`git status`).
- Commit the PDF, the Markdown, the HTML and the images together on the branch you were given. Push it.
- Send the PDF to the owner (`SendUserFile`).
- **Final message to the owner:** lead with the plain-language takeaway. Then list: what the guide covers; that the screenshots use sample data; anything found while building that the owner should know (gaps, a page that does not fit a phone, a text that conflicts with their policy); anything you could not test.

---

## Things to look for and report (found while building the first guide)

Building a guide is also a review of the product. Tell the owner about:

- **Features that exist in the code but are missing from the docs**, and docs that are wrong.
- **Features customers will expect that are not built** (example: a WhatsApp number for each person in a shared-code group).
- **Screens that do not fit a phone.** (Example: the Guests table is wider than a phone; the Messages page fits.)
- **Safety traps in the flow.** (Example: Step 2 lists guests who have not had Step 1, so the guide tells the admin to check the ticks line first.)
- **Wording that conflicts with a rule.** (Example: the reminder message repeats the guest code.)

---

## Guides to write next (suggested)

Follow the same format for these when asked: Guests (add, edit, groups, families), Table Arrangement and seating, Theme, Site wording, Sections, Events, Gallery, Dashboard, and a Guest-side guide (how a guest opens the invitation, uses their code and answers the RSVP). For guest-side guides, capture the public pages (`app/(public)/**`) at phone width first, because guests use phones.

---

## Files in this kit

| File | What it is |
|---|---|
| `docs/USER_GUIDE_PLAYBOOK.md` | This standard. |
| `docs/user-guide-kit/guide-template.html` | The page layout and CSS. Copy it. |
| `docs/user-guide-kit/example-capture-messages.js` | Working screenshot script with the marker helper. |
| `docs/user-guide-kit/render-pdf.js` | HTML to A4 PDF. |
| `docs/user-guide-kit/seed-demo.sql` | Made-up guests, tables and ticks for the demo database. |
| `docs/message-center-guide/` | The first finished guide (HTML source and images). |
| `docs/MESSAGE_CENTER_GUIDE.pdf` and `.md` | The finished PDF and its text version. |

If the database changes (a new migration), re-check `seed-demo.sql` still loads, and update it.
