# Backup & Recovery

RSVP data is the one thing in this project that cannot be recreated. Code can be
rewritten and the theme can be re-picked, but you cannot ask 300 guests to RSVP
again — and you certainly cannot do it the week of the wedding. This document is
the procedure for making sure that never becomes necessary.

Status as of 2026-09-06: **application-level backups work and have been run.
Provider-level backups are unverified — see "What still needs you" below.**

## Two independent layers

Neither layer is sufficient alone, which is the point of having both.

| Layer | Covers | Fails against |
|---|---|---|
| Provider (Neon) point-in-time restore | The whole database, including schema, to any moment in the retention window | Account loss, provider outage, retention window expiring, a bad restore |
| `npm run backup` (this repo) | Every row in every table, as JSON on your own disk | Schema (replayed from `migrations/` instead) |

The provider layer is the one you want after an accidental `DELETE`. The local
layer is the one you want if the account is gone or the retention window has
already rolled past the mistake.

## Taking a backup

```bash
npm run backup
```

Writes `backups/backup-<timestamp>.json` and prints a row count per table. It
discovers tables from the database catalog rather than a hardcoded list, so a
table added by a future migration is picked up without anyone remembering to
update the script.

```bash
npm run backup:verify
```

Reads the newest backup back off disk and reports what is in it. Run this after
every backup. A file you have never opened is a guess, not a backup.

`backups/` is gitignored, and must stay that way — **every backup contains each
guest's name, phone number and email address.** Do not commit one, do not paste
one into a chat, and think before putting one in a synced folder.

### When to run it

- Before every migration (this is already the riskiest routine operation)
- Before any bulk edit of the guest list
- Once a week from now until the invitations go out
- Daily once invitations are out and RSVPs are arriving
- The morning of the wedding

## What a backup does and does not contain

Contains: all rows of all tables, including `schema_migrations`, so a restore
knows exactly which migrations the data expects.

Does not contain: the schema itself, uploaded images (those live in Supabase
Storage), or anything in `.env`. Losing `.env` means losing `SESSION_SECRET`,
which invalidates every guest session — annoying but recoverable, guests just log
in again. Keep `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` somewhere you can
retrieve them independently of this machine.

## Restoring

Restoring to production is destructive and is HITL-gated per `HITL.md` — it needs
explicit human confirmation, never an agent acting alone.

**Prefer the provider's point-in-time restore** when it is available and the
retention window covers the incident. It restores schema and data together and
does not depend on anyone having remembered to run a backup that day.

Falling back to a JSON backup, the order matters because of foreign keys:

1. Provision an empty database and set `DATABASE_URL` to it.
2. `npm run migrate` — replays `migrations/` to build the schema. Cross-check the
   applied list against the backup's `schema_migrations` rows; they should match.
3. Load rows parents-first: `theme_settings`, `site_sections`,
   `celebration_events`, `message_templates`, `admin_users`, then `guests`, then
   `rsvp_responses`, `message_logs`, `probable_attendees`, `seating_tables`, and
   finally `table_seats` (which references both guests and probable_attendees).
4. Reset the sequences on any table using a serial primary key, or the next
   insert will collide with a restored row.
5. Confirm counts against the backup header before pointing the app at it.

## What still needs you

These need a browser and an account login, so they could not be done from here:

- [ ] **Confirm Neon's history-retention / point-in-time restore setting** for
      this project in the Neon console, and note the actual retention window
      below. Do not assume the default is long enough.
- [ ] **Rehearse one restore** into a scratch Neon branch — take a backup, restore
      it somewhere disposable, confirm the guest list and RSVPs come back intact.
      This is the only step that turns "we have backups" into a fact. It needs a
      scratch database, which is why it is not automated here.
- [ ] **Decide where backups live off this laptop.** A backup that only exists on
      the machine that might fail is half a backup. Given the PII, pick somewhere
      private rather than a shared drive.

Record the answers here once known:

- Neon retention window: _unknown_
- Last restore rehearsal: _never_
- Off-machine backup location: _none_

## Known gaps

- The backup runs on demand only. There is no schedule; if nobody runs it, there
  is no backup. Consider a scheduled task once invitations are out.
- Uploaded images are not backed up. Not currently an issue — image upload is not
  wired into the live app — but it becomes one the moment it ships.
- `pg` prints an SSL-mode deprecation warning on connect. Pre-existing and
  harmless today, but it signals a future `pg` major upgrade will need attention.
