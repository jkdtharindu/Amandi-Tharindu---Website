-- 038_home_section_order.sql
-- Added 2026-11-04: the admin can reorder the built-in homepage sections.
--   display_order is the section's position (1 = first below the top banner).
--   NULL means "never reordered": the code then uses the default order.
-- Parts of a section (small label, heading, paragraph, ...) are stored in this
-- same table under keys like 'our-story:milestones', so they need no new column.
-- HITL: the owner runs `npm run migrate` BEFORE pushing the code that saves the
-- order. Reading is safe without it (a read failure means "default order"),
-- but saving a new order would fail until this column exists.

ALTER TABLE home_section_visibility
  ADD COLUMN IF NOT EXISTS display_order integer;
