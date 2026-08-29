-- 006_add_invitation_code_format.sql
-- Makes the InvitationCode format configurable.
--
-- A code is printed on a physical wedding card and is the guest's login
-- credential, so the format is free to change only until cards go to print.
-- These settings affect codes generated AFTERWARDS -- an existing code is never
-- rewritten, or the guest holding that card could no longer sign in.
--
-- 'last' preserves the original behaviour (surname = last word of the name).
-- 'first' suits names that place the ancestral/ge name first, which is common
-- in Sri Lanka and where the original rule produces a code built from the
-- given name instead.
--
-- NOT YET APPLIED to any database -- HITL.md requires explicit approval before
-- running migrations.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS invitation_code_surname_position text NOT NULL DEFAULT 'first',
  ADD COLUMN IF NOT EXISTS invitation_code_group_prefix boolean NOT NULL DEFAULT false;

-- Guard the only two supported values, so a bad write cannot produce codes in
-- an unknown shape.
ALTER TABLE theme_settings
  DROP CONSTRAINT IF EXISTS theme_settings_code_surname_position_check;

ALTER TABLE theme_settings
  ADD CONSTRAINT theme_settings_code_surname_position_check
  CHECK (invitation_code_surname_position IN ('last', 'first'));
