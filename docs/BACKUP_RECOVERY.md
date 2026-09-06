# Backup & Recovery

RSVP data is the one thing in this project that cannot be recreated. Code can be
rewritten and the theme can be re-picked, but you cannot ask 300 guests to RSVP
again — and you certainly cannot do it the week of the wedding. This document is
the procedure for making sure that never becomes necessary.

Status as of 2026-09-06: **application-level backups work and have been run, and a
restore path now exists and is tested (`npm run restore`). No restore has yet been
executed against a real database, and provider-level backups are unverified — see
"What still needs you" below.**

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

Falling back to a JSON backup, use `npm run restore`.

**The target is named by `RESTORE_TARGET_URL`, never `DATABASE_URL`.** This is the
central safety property: having `.env` loaded is not enough to reach the live
database, so no mistyped command can overwrite production by default. Pointing the
two at the same database is refused unless `--overwrite-app-database` is passed,
which is HITL-gated per `HITL.md`.

```bash
# 1. Provision an empty database (a Neon branch is ideal) and build its schema.
RESTORE_TARGET_URL='postgres://...scratch...' DATABASE_URL='postgres://...scratch...' npm run migrate

# 2. Look before you leap — connects, plans, writes nothing.
RESTORE_TARGET_URL='postgres://...scratch...' npm run restore:dry-run

# 3. Restore for real.
RESTORE_TARGET_URL='postgres://...scratch...' npm run restore
```

The dry run reports the insert order, any migrations the target is missing, and
how many rows and sequences it would touch. Run it first, every time.

What the script handles for you, so it cannot rot the way a written-down list
would:

- **Insert order** is computed from the target's own foreign keys, not a
  hardcoded list — a migration that adds a new reference is picked up
  automatically, the same reasoning that makes the backup discover its tables
  from the catalog.
- **Sequence resets** run after the rows land, so the next insert does not
  collide with a restored id. This is the failure that otherwise surfaces days
  later, long after the restore looked successful.
- **All-or-nothing**: the whole load runs in one transaction and rolls back on
  any error, so a failed restore leaves the target as it was rather than half
  populated.
- **Migration cross-check** against the backup's `schema_migrations` rows, with a
  warning if the target's schema is older than the data.
- **Non-empty targets are refused** unless `--replace` is passed, which
  `TRUNCATE`s first.

Afterwards it re-counts every table and compares against the backup, and says
plainly if they disagree.

Useful flags: `--file <path>` to restore a specific backup rather than the newest,
`--replace` to clear a non-empty target, `--dry-run` as above.

## What still needs you

These need a browser and an account login, so they could not be done from here:

- [ ] **Confirm Neon's history-retention / point-in-time restore setting** for
      this project in the Neon console, and note the actual retention window
      below. Do not assume the default is long enough.
- [ ] **Rehearse one restore** into a scratch Neon branch. Create a branch in the
      Neon console, then:

      ```bash
      RESTORE_TARGET_URL='<scratch branch url>' DATABASE_URL='<scratch branch url>' npm run migrate
      RESTORE_TARGET_URL='<scratch branch url>' npm run restore:dry-run
      RESTORE_TARGET_URL='<scratch branch url>' npm run restore
      ```

      Then open the scratch branch and confirm the guest list and RSVPs came back
      intact. This is the only step that turns "we have backups" into a fact.
      **Correction (2026-09-06):** this item previously said it was not automated
      because it needed a scratch database. That was not the real blocker — there
      was no restore code at all, so the rehearsal was impossible for anyone. There
      is now (`scripts/restore-db.js`); what genuinely needs you is the Neon branch.
- [ ] **Decide where backups live off this laptop.** A backup that only exists on
      the machine that might fail is half a backup. Given the PII, pick somewhere
      private rather than a shared drive.

### What is proven, and what is not

Being precise about this, because "we have backups" was previously believed on
weaker evidence than it deserved:

| Claim | Evidence |
|---|---|
| Backups are taken and readable | `npm run backup` run against the live database; `npm run backup:verify` reads it back |
| Restore ordering, sequence resets, backup validation | 16 unit tests (`tests/restore-plan.test.mjs`) |
| A restore cannot reach the live database by accident | Observed refusing, twice, against the real `DATABASE_URL` — not asserted |
| **Rows actually come back into a real database** | **Not proven.** No Postgres is installed on this machine and no scratch branch exists yet, so no restore has ever been executed against a real server. This is what the rehearsal above is for. |

Until that last row is filled in, the restore path is well-tested code that has
never been run in anger. That is a great deal better than the prose list it
replaced, and still short of a fact.

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
