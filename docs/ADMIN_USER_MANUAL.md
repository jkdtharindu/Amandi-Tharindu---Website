# Admin User Manual — Amandi & Tharindu Wedding Website

**Last updated:** 2026-09-20

---

## Table of Contents

1. [Login & Account Setup](#login--account-setup)
2. [Admin Dashboard Overview](#admin-dashboard-overview)
3. [Managing Your Guest List](#managing-your-guest-list)
4. [WhatsApp Messaging & Reminders](#whatsapp-messaging--reminders)
5. [Table Assignment & Seating](#table-assignment--seating)
6. [Coordination Between Bride & Groom](#coordination-between-bride--groom)
7. [Troubleshooting](#troubleshooting)

---

## Login & Account Setup

### Your Login Credentials

You have **two separate admin accounts** — one for the bride's side, one for the groom's side.

- **Bride:** Email and password provided separately
- **Groom:** Email and password provided separately

Each of you logs in with your own credentials at `[website-url]/admin`.

### What You See When Logged In

When you log in, you only see your own party's information:
- Your invitee list (guests you invited)
- Your table assignments
- Your party's RSVP statistics
- Message templates and sending history for your guests

**You will NOT see:**
- Your spouse's invitee list
- Your spouse's table assignments
- Your spouse's messages or templates

---

## Admin Dashboard Overview

The dashboard shows your party's key statistics at a glance:

### Your Party's Stats
```
Invited: [count]
Accepted: [count] ([percentage]%)
Declined: [count]
Pending: [count]
```

### Wedding Total (Both Parties)
```
Total Invited: [count]
Total Accepted: [count]
Total Declined: [count]
Total Pending: [count]
```

### Message Tracking
Below the stats, a table shows each of your guests and the status of messages sent to them:

- **✓ (Checkmark)** = Message sent
- **☐ (Empty box)** = Message pending (not yet sent)

Common message events:
- RSVP Reminder
- Thank You for RSVP
- Table Details Update
- Final Reminder

---

## Managing Your Guest List

### Adding Guests

1. Go to **Guests** in the admin menu
2. Click **Add Guest**
3. Enter:
   - **Name:** Primary contact for this family/party
   - **Relationship:** Family, Colleagues, Friends, Neighbours, or Other
   - **Participant Count:** Maximum number of people in their party (e.g., 4 people)
4. Click **Save** — a unique invitation code is auto-generated (e.g., `SILVA-001`)
5. **Important:** The guest is automatically assigned to your party (bride or groom). You cannot change this later.

### Editing Guest Details

1. Find the guest in your list
2. Click **Edit**
3. You can change: name, relationship, participant count, WhatsApp number
4. **You CANNOT change:** the party assignment (bride/groom)
5. Click **Save**

### Deleting a Guest

1. Find the guest in your list
2. Click **Delete** — the guest is soft-deleted (their RSVP data is preserved for record-keeping)
3. They will NOT be able to log in and RSVP anymore
4. Their data remains in the system for historical records

### Importing Multiple Guests at Once

1. Prepare a CSV file with columns: `name`, `relationship`, `slot_count`
2. Go to **Guests** → **Import CSV**
3. Upload the file
4. Review the preview
5. Click **Confirm Import** — all guests are assigned to your party automatically

**Important:** Do NOT try to invite the same person under both bride and groom. The system will reject it as a duplicate.

---

## WhatsApp Messaging & Reminders

### Sending a Message to a Guest

1. Go to **Dashboard** or **Guests**
2. Find the guest you want to message
3. Click the **WhatsApp** button next to their name
4. A dropdown menu appears with message templates:
   - Thanks for submitting RSVP
   - Reminder to RSVP
   - Table number details update with greetings
   - Final Reminder (or custom messages)
5. Click a template — a preview appears with the message filled in with the guest's details
6. Review the message
7. Click **Send via WhatsApp** — this opens WhatsApp on your phone with the message pre-filled
8. Manually press **Send** in WhatsApp

### After You Send a Message

Once you've sent a WhatsApp message:

1. Return to the website dashboard
2. Find the guest in the message tracking table
3. Check the box next to the message type you just sent (e.g., ✓ RSVP Reminder)
4. This marks the message as **completed** so you know not to send it again

### Message Templates & Personalization

All message templates are shared (the same for both bride and groom), but each message is **personalized** with:

- Guest's name
- Guest's unique invitation code
- Guest's assigned table number (if assigned)
- Wedding event details (date, time, venue)
- Your greeting (e.g., "Hi from Amandi" or "Hi from Tharindu")

### Example: "Thanks for Submitting RSVP" Message

```
Hi Nimal,

Hi from Amandi!
Thanks for confirming your attendance! 🎉
Your table assignment: Table 5
Your invitation code: SILVA-001

See you at the Grand Hotel on 14 Dec at 6:00 PM.

Warm regards,
Amandi & Tharindu
```

---

## Table Assignment & Seating

### Assigning Guests to Tables

1. Go to **Table Arrangement** in the admin menu
2. You see only your party's tables and guests
3. Find an unassigned guest in the list
4. Click **Assign to Table** and select a table number
5. The guest is now seated at that table

### Viewing Table Assignments

1. Go to **Table Arrangement**
2. Each table shows:
   - Table number
   - Assigned guests (from your party only)
   - Capacity remaining
3. You can rearrange guests by clicking **Move Guest** to another table

### Important Notes

- **You cannot see your spouse's table assignments** — each party manages their own seating
- **You cannot assign your spouse's guests to a table** — the system prevents cross-party assignment
- If you need to know the total table capacity or resolve overlaps, **coordinate with your spouse** (see below)

---

## Coordination Between Bride & Groom

### Before Making Major Changes

Both the bride and groom should **discuss and agree** on the following before one of you makes the change:

1. **Adding or removing guests** — communicate who is being invited and from which side
2. **Table assignments** — ensure tables don't conflict (e.g., overlapping space or capacity issues)
3. **Sending messages** — coordinate the timing and content to avoid conflicting information to guests

### Example Coordination Workflow

**Scenario:** You want to add 50 new guests.

1. **Bride & groom discuss together** — finalize the list and who invites whom
2. **One of you logs in** (let's say the bride) and imports the CSV of bride's guests
3. **The groom does the same** with groom's guest list in a separate import
4. **Check the dashboard together** — confirm total accepted/pending counts make sense
5. **Proceed to table assignments** once both sides are ready

### If Table Assignments Conflict

**Scenario:** The bride assigns guests to Table 1, but the groom also needs Table 1 for his guests.

1. **The groom sees his table list** — they're separate, so no direct conflict in the system
2. **But in the real venue**, both sides might be trying to use the same physical table
3. **Solution:**
   - Groom contacts bride: "I need Table 1 for my guests — can we use Table 2 for yours?"
   - **One admin locks the layout** to prevent accidental changes while discussing
   - **Both admins log in** (on separate devices if needed) and adjust table positions together
   - **Once done**, unlock the layout and mark it finalized

### No "Locked" Indicator Yet

*Note: Layout locking is planned for a future version to prevent accidental overwrites during coordination.*

---

## Troubleshooting

### I Cannot See a Guest in My List

**Reason:** The guest is assigned to your spouse's party, not yours.

**Solution:** Ask your spouse to manage that guest. Or, if the person should have been added to your party, delete the guest on your spouse's side and re-add them on yours.

### I Cannot Assign a Guest to a Table

**Reason:** The guest is assigned to your spouse's party.

**Solution:** Only your spouse can assign their guests to tables. Coordinate with them to do this.

### A Message Says "Unauthorized"

**Reason:** You tried to access or edit data (guests, tables) that belongs to your spouse's party.

**Solution:** This is a security protection. Check that you're editing your own guests and tables only.

### I Forgot My Password

1. Go to `/admin` login page
2. Click **Forgot Password?**
3. Enter your email
4. Check your email for a reset link
5. Create a new password
6. Log in with your new password

### I'm Getting a Different Count Than Expected

**Reason:** The dashboard shows both your party's stats AND the total wedding stats. Make sure you're looking at the right row.

**Tip:** Check the table labels:
- "BRIDE'S PARTY" = your stats (if you're the bride)
- "GROOM'S PARTY" = your stats (if you're the groom)
- "TOTAL" = combined stats for both parties

---

## Contact Support

If you encounter issues not covered in this guide:

1. Check this document again (use the Table of Contents above)
2. Restart your browser and log back in
3. If the issue persists, contact the website developer with a screenshot and description of what went wrong

---

**Questions?** Ask your spouse first — many issues are resolved by coordinating together.

**Date this guide was created:** 2026-09-20
