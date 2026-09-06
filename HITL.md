# Human-in-the-Loop (HITL) Guardrails

This project requires explicit human approval before certain actions are taken. Do not proceed unless the user explicitly says "yes" or "yes, proceed".

## Required HITL Pause Rules

Whenever one of the following actions is about to happen, stop and present the checkpoint message exactly in this format:

"⚠️ HITL CHECKPOINT: I am about to [action]. This will [consequence]. Shall I proceed? (yes / no)"

## Actions Requiring HITL

- Any deployment or publish command
- Database migrations (up or down)
- Restoring a database from a backup, or any other bulk overwrite of live data (see `docs/BACKUP_RECOVERY.md`) — a restore silently discards everything written since the backup was taken, so it is destructive even when it succeeds
- Deleting files or records
- Touching environment variables or secrets
- git push to main or production branches
- Any external API call that costs money or sends messages
- Creating or updating live production content that affects guests publicly
- Sending WhatsApp, SMS, or email messages to guests
- Changing admin access, authentication, or role configuration
- Modifying Supabase storage buckets, policies, or database permissions
- Making changes that could affect the live wedding website during the RSVP period

## Project-Specific HITL Notes

Because this project is a guest-facing wedding website with RSVP handling and messaging, the following are especially sensitive:

- Any change that could expose or alter guest RSVP data
- Any change that affects invitation access or authentication
- Any change that sends reminders, confirmations, or bulk communications
- Any update to payment, gifting, or external booking integrations (if introduced later)
- Any change to public pages that could break the wedding experience during the event period

## Expected Behavior

- Never infer consent
- Never proceed because it seems like the right next step
- Never act on a vague or implied approval
- Wait for a clear explicit confirmation before continuing

Note: UI polish and local prototype changes (code edits, styling, docs) do not bypass HITL requirements — any deploys, migrations, or external sends still require the exact HITL checkpoint confirmation.

## Clarification: WhatsApp reminder button (added 2026-09-03)

The admin guest list has a "send RSVP reminder" button on pending guests with a WhatsApp number. It builds a `wa.me` deep link from an admin-editable message and opens it — nothing is sent programmatically. The admin still presses Send inside WhatsApp under their own account. This does NOT call an external paid API and does NOT by itself constitute "sending WhatsApp... messages to guests" in the automated sense the rule above is guarding against, so it does not require its own HITL checkpoint. If this is later replaced with a programmatic send (e.g. a paid WhatsApp/SMS API called directly from server code), that change brings back the full HITL requirement above. (Twilio specifically was considered and decided against for cost — see MEMORY.md 2026-09-05 — so this is a hypothetical guard, not a planned change.)

## Clarification: backups, restores and the dry run (added 2026-09-06)

"Restoring a database from a backup" is listed above as requiring a checkpoint. Now that
`npm run restore` exists (`scripts/restore-db.js`), the boundaries are specific:

- **`npm run restore:dry-run` is NOT a HITL action.** It connects, plans, and issues only
  `SELECT`s, returning before the transaction opens. It cannot write. Requiring a checkpoint
  for a read-only inspection would only devalue the checkpoints that matter.
- **Restoring into a disposable scratch database is NOT a HITL action.** No live data is
  involved — that is the entire point of rehearsing there. The restore target is named by
  `RESTORE_TARGET_URL`, which deliberately never falls back to `DATABASE_URL`.
- **Restoring into the application's own database IS a full HITL action**, and requires the
  exact checkpoint message above. The script refuses this by default and only proceeds with
  `--overwrite-app-database`. That flag is not a substitute for the human confirmation; it is
  what you type *after* getting it. A restore silently discards everything written since the
  backup was taken, so it is destructive even when it succeeds.
- **`npm run backup` is not a HITL action** (it only reads), and neither is
  `npm run backup:encrypt`. But `--remove-plaintext` deletes a file, so it falls under
  "Deleting files or records" — the script verifies the encrypted copy decrypts byte-for-byte
  before it will delete anything, which mitigates but does not remove the need for care.
