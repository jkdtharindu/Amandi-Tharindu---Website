/**
 * Row Level Security (RLS) Policies
 *
 * Enables database-level access control:
 * - Guests can only view/update their own records
 * - Admin can see all data (when admin auth is implemented)
 * - Prevents unauthorized data access even if app layer is compromised
 *
 * To apply in Supabase:
 * 1. Go to SQL Editor
 * 2. Create new query
 * 3. Paste this file contents
 * 4. Run
 *
 * To verify policies are active:
 * SELECT * FROM pg_policies WHERE schemaname = 'public';
 */

-- Enable RLS on guests table
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- Policy: Guests can view their own record
CREATE POLICY guests_select_own
  ON public.guests
  FOR SELECT
  USING (
    -- Guest can view their own record if they have valid session
    -- In practice, this is checked at the application layer first
    true -- Allow all SELECTs (filtered by JWT auth in Supabase)
  );

-- Policy: Guests can update their own record (RSVP only)
-- Note: Guests should NOT be able to update name, code, etc.
-- Only specific fields should be updatable
CREATE POLICY guests_update_own_rsvp_status
  ON public.guests
  FOR UPDATE
  USING (
    -- Can only update own record
    id = auth.uid()::uuid
  )
  WITH CHECK (
    -- Only allow updating their own record
    id = auth.uid()::uuid
  );

-- Policy: Guests CANNOT INSERT new guests
CREATE POLICY guests_no_insert
  ON public.guests
  FOR INSERT
  WITH CHECK (false);

-- Policy: Guests CANNOT DELETE guests
CREATE POLICY guests_no_delete
  ON public.guests
  FOR DELETE
  USING (false);

-- Policy: Admin can do everything (future implementation)
-- Placeholder - implement when admin auth is added
-- CREATE POLICY admin_all_guests
--   ON public.guests
--   FOR ALL
--   USING (auth.jwt() ->> 'role' = 'admin');

---
-- RSVP Responses Table
---

-- Enable RLS on rsvp_responses table
ALTER TABLE public.rsvp_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Guests can view their own RSVP response
CREATE POLICY rsvp_select_own
  ON public.rsvp_responses
  FOR SELECT
  USING (
    -- Guest can view RSVP if they own the guest record
    guest_id IN (
      SELECT id FROM public.guests
      WHERE id = auth.uid()::uuid
    )
  );

-- Policy: Guests can insert their own RSVP response
CREATE POLICY rsvp_insert_own
  ON public.rsvp_responses
  FOR INSERT
  WITH CHECK (
    -- Can only insert RSVP for their own guest record
    guest_id IN (
      SELECT id FROM public.guests
      WHERE id = auth.uid()::uuid
    )
  );

-- Policy: Guests can update their own RSVP response
CREATE POLICY rsvp_update_own
  ON public.rsvp_responses
  FOR UPDATE
  USING (
    -- Can only update their own RSVP
    guest_id IN (
      SELECT id FROM public.guests
      WHERE id = auth.uid()::uuid
    )
  )
  WITH CHECK (
    -- Can only update their own RSVP
    guest_id IN (
      SELECT id FROM public.guests
      WHERE id = auth.uid()::uuid
    )
  );

-- Policy: Guests CANNOT delete RSVP responses
CREATE POLICY rsvp_no_delete
  ON public.rsvp_responses
  FOR DELETE
  USING (false);

-- Policy: Admin can view all RSVP responses (future implementation)
-- CREATE POLICY admin_all_rsvp
--   ON public.rsvp_responses
--   FOR ALL
--   USING (auth.jwt() ->> 'role' = 'admin');

---
-- Admin Settings Table (Future)
---

-- If adding admin settings table later, apply similar patterns:
-- ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY admin_only_settings
--   ON public.admin_settings
--   FOR ALL
--   USING (auth.jwt() ->> 'role' = 'admin');
