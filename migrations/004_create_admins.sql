-- 004_create_admins.sql
--
-- Single-admin table per PRD P0-09 (exactly one admin account, no
-- multi-admin system). Password hashing happens in the application layer
-- (src/password.js) before insert — this column stores "salt:hash", never
-- a plaintext password.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- The admins table must never be reachable from Supabase's anon or
-- authenticated client roles — only the server, using the service_role
-- key (which bypasses RLS), should ever query it. This blanket-deny
-- policy is a safety net in case a client-side Supabase key is ever used
-- against this table by mistake.
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_deny_client_access
  ON public.admins
  FOR ALL
  USING (false)
  WITH CHECK (false);
