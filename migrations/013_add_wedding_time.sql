-- 013_add_wedding_time.sql
-- Next Action 24: admin-editable wedding date + ceremony time, and a
-- countdown that no longer drifts by the viewer's own timezone.
-- wedding_date was a bare `date` column with no time-of-day, which is why
-- the countdown's ceremony start time ("15:00") was hardcoded in
-- Countdown.tsx instead of coming from theme_settings. Stored as 24-hour
-- "HH:MM" text (the native <input type="time"> format) rather than a
-- Postgres `time` type, matching celebration_events.event_time (migration
-- 009) -- simple to combine into an ISO string with a fixed +05:30 offset
-- for the countdown target, with no separate parsing step.

ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS wedding_time text DEFAULT '15:00';
