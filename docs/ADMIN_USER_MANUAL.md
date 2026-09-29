# Admin User Manual — Amandi & Tharindu Wedding Website

> **Living document — checked against the actual site on 2026-09-28.** Two admin accounts (bride and groom) are live and working. A few things an earlier draft of this guide described were never actually built, and have been removed below: importing guests from a CSV file, a self-service "Forgot password" link, and "locking" the seating layout while you coordinate (the owner decided against building this). As of today, the Guests page, Table Arrangement, Export CSV, the spreadsheet download and the Messages page are **all** split by side — see [What's Shared vs. What's Per-Side](#whats-shared-vs-whats-per-side) for the two things that are still deliberately shared. Some of what's below (table sides/Common tables, the everyday-leaks side-scoping fix, the Messages drop-down) is finished and tested but was still waiting on the owner's `npm run migrate` and a push as of this update — if a screen looks different from this guide, that's most likely why.

**Last updated:** 2026-09-28

---

## Table of Contents

1. [Login & Account Setup](#login--account-setup)
2. [What's Shared vs. What's Per-Side](#whats-shared-vs-whats-per-side)
3. [Admin Dashboard Overview](#admin-dashboard-overview)
4. [Managing Your Guest List](#managing-your-guest-list)
5. [WhatsApp Messaging](#whatsapp-messaging)
6. [Table Assignment & Seating](#table-assignment--seating)
7. [Coordination Between Bride & Groom](#coordination-between-bride--groom)
8. [Troubleshooting](#troubleshooting)

---

## Login & Account Setup

### Your Login Credentials

You each have **your own admin account** — one for the bride, one for the groom, with separate emails and passwords. Sign in at `/admin`.

### There Is No "Forgot Password" Link

If you forget your password, there's no self-service reset yet. Ask your developer to set a new one for you — it's a one-line command they run (`npm run admin:set-password`), not a database change.

### What You See When Logged In

Nearly everything you see and manage is your own side's only. See the next section for the two deliberate exceptions.

---

## What's Shared vs. What's Per-Side

This is the single most important thing to know about the admin panel, so it gets its own section.

**Split by side (you only see and manage your own):**
- The **Guests** page — your guest list, adding/editing/removing guests, the add-person approval panel
- **Export CSV** (from the Dashboard) — your own guests only
- The **Table Arrangement** page — your own tables and who's seated at them
- **Download spreadsheet** (from Table Arrangement) — your own tables only
- The **Messages** page — you can only see and message your own guests here, and "Recent messages" only shows your own sending activity

**Deliberately shared (both of you see and act on the same thing):**
- **Common tables** — a table either of you can mark "Common" holds both sides' people; you both see who's sitting there, but you can each still only seat or remove your own side's people on it. See [Table Assignment & Seating](#table-assignment--seating).
- The **Dashboard's "Overall (Both Parties)" row** — a combined total shown next to your own numbers, on purpose, so you can each see how the whole wedding is tracking without seeing each other's guest lists.
- Anything that isn't guest data — Theme, Sections, Events and Gallery are whole-site content, not split by side.

That's it. Nothing else shows your spouse's guests, tables or messages by default.

---

## Admin Dashboard Overview

### The Dashboard Page

Shows two rows of numbers, one above the other:

**Your Party** — just your own guests:
```
Total invited: [count]
Accepted: [count]  (with a note of how many people that is)
Declined: [count]
Awaiting reply: [count]
```

**Overall (Both Parties)** — the same four numbers, combined across both sides.

Below both rows is a breakdown chart of the combined numbers, and an **Export CSV** button (your own guests only — see above).

### The Table Arrangement Page

This page shows the same two-row pattern: **"Your Party"** (just your own guests) and **"Overall (Both Parties)"** (combined). Each set shows:
- **RSVP Accepted**
- **Table Arranged** — how many accepted people are actually seated
- **Balance to Arrange** — accepted people who aren't seated yet
- **RSVP Not Accepted** — declined + still-pending, added together

Above the tables is a **Leftover seating** panel — see [Table Assignment & Seating](#table-assignment--seating) for what it shows.

There is no message-tracking checklist on the Dashboard — that idea was replaced by the per-guest tick-box on the Guests page's Messages drop-down (see below).

---

## Managing Your Guest List

### Adding a Guest

1. Go to **Guests** in the admin menu
2. Click **Add guest**
3. Fill in:
   - **Full name** — the primary contact for this party
   - **Group** — a category such as Relations, Colleagues, Neighbours, or Friends (your developer can customize this list)
   - **Seats** — how many people are in their party
   - **WhatsApp number** (optional)
4. Click **Add guest** — an invitation code is generated automatically, e.g. `NEI-RU-742` (3 letters from the group, 2 from the first name, 3 random digits)
5. The guest is assigned to your side automatically. This can't be changed later.

### Naming Individuals in a Party

If a party has **more than one seat**, you're asked to name each person (a party of one doesn't need this — they're just the one name). This matters because:
- Each named person can be seated individually at Table Arrangement, rather than the whole party as a block
- Their invitation shows the **name** of the table they're seated at (never a raw number — see [Table Assignment & Seating](#table-assignment--seating)), and if others from their party are seated at the same table, it adds "— with [their names]"

You can add more named people to an existing party later from the **Edit** screen — type the names, then either use the small **Add these people** button on the spot, or type them and press the main **Save changes** button, which now saves everything together.

### Editing a Guest

1. Find the guest and click **Edit**
2. Change name, group, WhatsApp number, or the named people in their party
3. You **cannot** change which side (bride/groom) they belong to
4. Click **Save changes**

### Removing a Guest

Click **Delete**, confirm the prompt. This is a soft delete: their RSVP history is kept for your records, any table seats they held are freed immediately, and they can no longer log in to RSVP. This can be undone by your developer if needed, but not from the admin panel itself.

### There Is No CSV Import

Adding guests one at a time through the form above is the only way right now — bulk import from a spreadsheet was planned but never built. If you have a lot of guests to add, budget time for entering them individually, or ask your developer about a one-off script.

**Important:** Don't invite the same person under both bride's and groom's lists — the invitation code system doesn't stop you doing this by hand, so it's on the two of you to agree who invites whom before adding anyone.

---

## WhatsApp Messaging

There are two separate ways to send a WhatsApp message, and they work differently. Neither one sends the message for you — both just open WhatsApp with the text ready, and you press Send yourself. Both are now split by side: you only ever message your own guests.

### Message One Guest (from the Guests page)

1. Find the guest in your list
2. Click the **WhatsApp** button next to their name — it opens a small drop-down
3. Pick a message kind: **RSVP reminder**, **Table number update**, **Final reminder**, or **Thank you**. Each fills in the message text for you — the table-number one names the table they're actually seated at (or says "not yet assigned" if they aren't seated yet); every kind that's already been sent to this guest shows a small ✓ next to its name
4. Edit the text if you like, then click **Open in WhatsApp** and press Send inside WhatsApp
5. **Tick "Mark … as sent"** yourself once you're done — opening WhatsApp does not tick it for you, so you decide when it counts as sent, and you can un-tick it later if you need to re-send

This is per-guest and keeps its own record of which of the four kinds each guest has had.

### Sending to a Group (the Messages page)

This is the more powerful tool, for reaching several guests at once:

1. Go to **Messages** in the admin menu
2. Pick a **Template** and an **Audience** (by RSVP status — pending, accepted, declined, or everyone — and optionally by group)
3. Tick **"Skip guests who already got this template"** to avoid re-sending to people you've already reached
4. Click **Start sending** — this opens a one-at-a-time worklist
5. For each person: review or edit the message, click **Open in WhatsApp**, press Send inside WhatsApp, then it automatically moves to the next person and logs that you sent it
6. Click **Skip** to leave someone for later without logging anything, or **Stop** to pause the run

The **Recent messages** panel on the right shows what's been sent and when — this is your message history for this tool, logged automatically the moment you open WhatsApp, so there's no separate box to tick afterwards. (This is a different log from the per-guest tick-boxes above — the two don't share a history.)

This page now shows only your own guests, same as the Guests page.

---

## Table Assignment & Seating

### Table Sides and Common Tables

Every table belongs to a side: **yours**, or **Common**. A table on your side can only be seen and seated by you; a Common table is shared — you both see who's sitting there, but each of you can still only seat or remove your own side's people on it. This is how leftover guests from both sides end up able to sit together once each side's own tables are full.

Table numbers start again at 1 for each side and separately for Common tables, so "Table 1" isn't unique — but guests are never shown a raw number anyway (see below), so this only matters to you.

### Creating a Table

1. Go to **Table Arrangement**
2. Fill in a **Table number**, a **Table name** (now required — e.g. "Rose Table" — this is what guests actually see), and **Capacity**
3. Choose **My side** or **Common**
4. Click **Create table**

A table's side can only be changed while it's empty, and only between your own side and Common — never straight to the other side's.

### Seating Someone

Each table shows its seats. For any empty seat, use its dropdown (labelled "Unassigned — select…") to pick who sits there — the list is grouped into **Accepted guests**, **Accepted invitees** (named individuals from a party), and two **Probable** groups (see below). Picking a name seats them immediately — there's no separate "confirm" step.

To move someone, click **Remove** on their seat first (which frees it and puts them back on the unassigned list), then assign them to a different seat.

A seated person is shown as just their name if they're a whole party, or "Name (Party name)" if they're a named individual — so two Davids from different families aren't confused with each other.

The system won't let you seat someone who has **declined** their invitation, assign a seat that doesn't exist, or seat your own guest at the other side's table (Common tables are the only shared option).

### The Leftover Seating Panel

Above the tables, a **Leftover seating** panel shows, for each side: how many accepted people still need a seat, how many empty seats that side's own tables have, and how many would be left over once those run out. Below that: the combined leftover across both sides, how many free seats exist on Common tables right now, and roughly how many more Common tables would be needed for the rest.

### Probable Attendance (buffer seats)

A **Probable attendance** panel — a way to hold a few spare seats for people who declined or haven't responded, in case they turn up anyway. Set an "Estimate likely to attend anyway" number for Declined and for Pending, and click **Save**; that many anonymous placeholder seats become available to assign from the dropdown above. They're never tied to a real name, and this buffer is shared between both sides (not split).

### Downloading the Seating Plan

The **Download spreadsheet** button exports your own side's tables — including Common tables you can see into, with a Side column so you can tell them apart. Note it's a plain text file with an `.xlsx` name, so Excel may warn you before opening it — that's expected, just open it anyway.

### Important Notes

- **You only see and manage your own side's tables and guests here**, except for Common tables, which you both see.
- **You cannot seat your spouse's guests anywhere, including Common tables** — the system only ever offers your own accepted guests, invitees, and probable-attendance slots.
- **Guests never see a table number** — only the table's name (or "Table N" if it was somehow never given one). This is on their invitation page and in any message that mentions their table.

---

## Coordination Between Bride & Groom

### Before Making Major Changes

Agree between yourselves before either of you:

1. **Adds or removes guests** — so you don't both end up inviting the same person
2. **Creates tables** — table names must be unique across the whole venue, so agree names before you both start creating them
3. **Sends WhatsApp messages** — each of you now only sees and messages your own guests, so this is mostly self-solving, but still agree on who's contacting anyone seated at a Common table together

### Example: Adding 50 New Guests

1. Discuss and finalize the list together — decide who invites whom
2. Each of you logs in and adds your own guests one at a time (there's no bulk import yet, so budget time for this)
3. Check the **Dashboard** together afterwards — its "Overall (Both Parties)" row shows the combined total, so you can confirm the numbers make sense
4. Move on to table assignment once both sides are ready

### If You Both Need to Seat Leftover Guests Together

Once your own tables are full, mark a table **Common** (yours or a new one) so both of you can seat your remaining people there. Check the **Leftover seating** panel first to see roughly how many Common tables you'll need between you.

---

## Troubleshooting

### I Cannot See a Guest in My List

**Reason:** They're on your spouse's side, not yours — the Guests page only shows your own.

**Solution:** Ask your spouse to check their list. If the guest should have been on your side, ask your spouse to delete them and re-add them under your account.

### I Cannot Seat a Guest

**Possible reasons:**
- They belong to your spouse's side (only your own accepted guests appear in the seating dropdown)
- They've declined their RSVP — declined guests can't be seated
- The seat is already taken — remove its current occupant first

### A Message Says "Unauthorized" or "Not Found"

You tried to open, edit or message a guest, table or seat that belongs to your spouse's side. This is a safety check working as intended — double check you're working with your own data. (A Common table itself is visible to you both; this only applies to who's allowed to sit there.)

### The Numbers Don't Match What I Expected

**On the Dashboard and Table Arrangement pages:** look for the two rows — **"Your Party"** is just your guests; **"Overall (Both Parties)"** is the combined total. Make sure you're reading the right one.

**Export CSV and Download spreadsheet** both only include your own side's data now.

### I Downloaded the Spreadsheet and Excel Warned Me

That's expected for now — the file is plain tab-separated text with an `.xlsx` name on it, not a real Excel workbook. Click through the warning; the data itself is correct.

### I Forgot My Password

There's no self-service reset. Contact your developer and ask them to set a new password for your account.

---

## Contact Support

If something isn't covered here:

1. Check this guide again (use the Table of Contents)
2. Try logging out and back in
3. If it's still broken, contact your developer with a screenshot and a description of what happened

---

**Questions?** Talk to your spouse first about who invites whom and who names which tables — since almost everything else is now split by side, most confusion left is about those two shared decisions rather than a bug.
