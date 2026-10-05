-- ==============================================================================
-- CI Auth Stub: ci/auth_stub.sql
-- Applied ONLY by CI workflow before migrations run against raw PostgreSQL container.
-- NEVER applied to managed Supabase environments or checked into supabase/migrations/.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    encrypted_password TEXT,
    email_confirmed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    is_super_admin BOOLEAN DEFAULT false,
    role TEXT DEFAULT 'authenticated'
);

-- Stub auth.uid() supporting both request.jwt.claim.sub and request.jwt.claims JSON
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif((CASE WHEN current_setting('request.jwt.claims', true) IS NOT NULL AND current_setting('request.jwt.claims', true) != '' 
            THEN (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') 
            ELSE NULL END), ''),
    (SELECT id FROM auth.users LIMIT 1)
  )::uuid;
$$;

-- Stub auth.role() supporting both request.jwt.claim.role and request.jwt.claims JSON
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((CASE WHEN current_setting('request.jwt.claims', true) IS NOT NULL AND current_setting('request.jwt.claims', true) != '' 
            THEN (current_setting('request.jwt.claims', true)::jsonb ->> 'role') 
            ELSE NULL END), ''),
    'authenticated'
  );
$$;

-- Ensure authenticated role exists in raw PostgreSQL and has schema access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;
END $$;

-- Populate deterministic auth.users for memberships FK satisfaction in seed
INSERT INTO auth.users (id, email)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'owner-a@bharat-electronics.in'),
    ('22222222-2222-2222-2222-222222222222', 'owner-b@deccan-logistics.in'),
    ('33333333-3333-3333-3333-333333333333', 'accountant@ca-sharma.in'),
    ('44444444-4444-4444-4444-444444444444', 'auditor@audit-india.in')
ON CONFLICT (id) DO NOTHING;
