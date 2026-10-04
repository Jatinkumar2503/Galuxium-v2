-- ==============================================================================
-- Migration: 20261005000004_enable_rls_default_deny.sql
-- Description: Enforce PostgreSQL Row-Level Security on EVERY table with default deny
-- ==============================================================================

-- 1. Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

-- 2. Memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

-- 3. Clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

-- 4. Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- 5. Extractions
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions FORCE ROW LEVEL SECURITY;

-- 6. Bank Transactions
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions FORCE ROW LEVEL SECURITY;

-- 7. Matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches FORCE ROW LEVEL SECURITY;

-- 8. Flags
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags FORCE ROW LEVEL SECURITY;

-- 9. Audit Log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- 10. Usage Events
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events FORCE ROW LEVEL SECURITY;

-- 11. API Keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

-- 12. Auth Failed Attempts (Locked to service role only)
ALTER TABLE auth_failed_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_failed_attempts FORCE ROW LEVEL SECURITY;
