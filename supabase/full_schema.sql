-- ==============================================================================
-- Migration: 20261005000001_initial_schema.sql
-- Description: Core relational schema for Galuxium Nexus V2
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Memberships
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'accountant', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_org_user UNIQUE (org_id, user_id)
);

-- 3. Clients (SME businesses serviced by an org)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gstin VARCHAR(15),
    state_code VARCHAR(2) NOT NULL,
    email TEXT,
    phone VARCHAR(15),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    content_hash CHAR(64) NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'queued', 'extracting', 'extracted', 'validated', 'failed')),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_org_doc_hash UNIQUE (org_id, content_hash)
);

-- 5. Extractions
CREATE TABLE IF NOT EXISTS extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    vendor_gstin VARCHAR(15),
    buyer_gstin VARCHAR(15),
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    taxable_amount NUMERIC(14, 2) NOT NULL,
    cgst_amount NUMERIC(14, 2) DEFAULT 0,
    sgst_amount NUMERIC(14, 2) DEFAULT 0,
    igst_amount NUMERIC(14, 2) DEFAULT 0,
    total_tax_amount NUMERIC(14, 2) NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    field_confidences JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_model_output JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Bank Transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL,
    value_date DATE,
    description TEXT NOT NULL,
    reference_number TEXT,
    debit_amount NUMERIC(14, 2) DEFAULT 0,
    credit_amount NUMERIC(14, 2) DEFAULT 0,
    balance NUMERIC(14, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Matches
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    match_score NUMERIC(5, 4) NOT NULL CHECK (match_score >= 0 AND match_score <= 1),
    match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'fuzzy_rule', 'llm_assisted', 'manual')),
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('auto_approved', 'pending_review', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES auth.users(id),
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Flags
CREATE TABLE IF NOT EXISTS flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES bank_transactions(id) ON DELETE SET NULL,
    flag_type TEXT NOT NULL CHECK (flag_type IN ('duplicate_invoice', 'gstin_invalid', 'tax_mismatch', 'date_outlier', 'amount_mismatch', 'split_payment')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    explanation TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Usage Events
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('document_processed', 'api_call', 'llm_tokens', 'storage_bytes')),
    quantity BIGINT NOT NULL DEFAULT 1,
    cost_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,
    latency_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash CHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(12) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read:invoices'],
    rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
    last_used_at TIMESTAMPTZ,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ==============================================================================
-- Migration: 20261005000002_lockout_and_audit.sql
-- Description: Cryptographic audit log and progressive lockout tables
-- ==============================================================================

-- 1. Immutable Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    prev_hash CHAR(64),
    entry_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Brute-Force & Progressive Account Lockout Table (Instruction 3.5)
CREATE TABLE IF NOT EXISTS auth_failed_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address INET NOT NULL,
    consecutive_failures INTEGER NOT NULL DEFAULT 1,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_email_ip UNIQUE (email, ip_address)
);

-- 3. Trigger Function: Block UPDATE and DELETE on audit_log (Append-Only)
CREATE OR REPLACE FUNCTION block_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Security Violation: audit_log is strictly append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION block_audit_log_modification();

-- 4. Organization updated_at touch trigger
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_updated ON organizations;
CREATE TRIGGER trg_org_updated
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
-- ==============================================================================
-- Migration: 20261005000003_org_indexes.sql
-- Description: Multi-tenant performance indexing and FK integrity
-- ==============================================================================

-- Index memberships
CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON memberships(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- Index clients
CREATE INDEX IF NOT EXISTS idx_clients_org_status ON clients(org_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_gstin ON clients(org_id, gstin);

-- Index documents
CREATE INDEX IF NOT EXISTS idx_documents_org_status ON documents(org_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_org_client ON documents(org_id, client_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_created ON documents(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(org_id, content_hash);

-- Index extractions
CREATE INDEX IF NOT EXISTS idx_extractions_org_date ON extractions(org_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_extractions_vendor_gstin ON extractions(org_id, vendor_gstin);
CREATE INDEX IF NOT EXISTS idx_extractions_inv_num ON extractions(org_id, invoice_number);

-- Index bank transactions
CREATE INDEX IF NOT EXISTS idx_bank_tx_org_date ON bank_transactions(org_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_tx_reference ON bank_transactions(org_id, reference_number);

-- Index matches
CREATE INDEX IF NOT EXISTS idx_matches_org_status ON matches(org_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_doc_tx ON matches(document_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(org_id, match_score DESC);

-- Index flags
CREATE INDEX IF NOT EXISTS idx_flags_org_resolved ON flags(org_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_flags_org_severity ON flags(org_id, severity);

-- Index audit log (optimized for ledger verification and filtering)
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(org_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entry_hash ON audit_log(entry_hash);

-- Index usage events
CREATE INDEX IF NOT EXISTS idx_usage_org_type ON usage_events(org_id, event_type, created_at DESC);

-- Index API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_org_active ON api_keys(org_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
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
-- ==============================================================================
-- Migration: 20261005000005_rls_role_policies.sql
-- Description: Role-Based Access Control (RBAC) policies by role: owner, accountant, viewer
-- ==============================================================================

-- Helper function: get caller role in an organization
CREATE OR REPLACE FUNCTION auth_org_role(target_org_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM memberships
    WHERE org_id = target_org_id AND user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: check if caller is an active member of organization
CREATE OR REPLACE FUNCTION is_org_member(target_org_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM memberships
        WHERE org_id = target_org_id AND user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 1. Organizations Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "org_select_members" ON organizations
    FOR SELECT TO authenticated
    USING (is_org_member(id));

CREATE POLICY "org_update_owner" ON organizations
    FOR UPDATE TO authenticated
    USING (auth_org_role(id) = 'owner')
    WITH CHECK (auth_org_role(id) = 'owner');

-- ------------------------------------------------------------------------------
-- 2. Memberships Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "memberships_select" ON memberships
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "memberships_insert_owner" ON memberships
    FOR INSERT TO authenticated
    WITH CHECK (auth_org_role(org_id) = 'owner');

CREATE POLICY "memberships_update_owner" ON memberships
    FOR UPDATE TO authenticated
    USING (auth_org_role(org_id) = 'owner')
    WITH CHECK (auth_org_role(org_id) = 'owner');

CREATE POLICY "memberships_delete_owner" ON memberships
    FOR DELETE TO authenticated
    USING (auth_org_role(org_id) = 'owner');

-- ------------------------------------------------------------------------------
-- 3. Clients Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "clients_select_all_roles" ON clients
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "clients_insert_accountant_owner" ON clients
    FOR INSERT TO authenticated
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

CREATE POLICY "clients_update_accountant_owner" ON clients
    FOR UPDATE TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

CREATE POLICY "clients_delete_owner" ON clients
    FOR DELETE TO authenticated
    USING (auth_org_role(org_id) = 'owner');

-- ------------------------------------------------------------------------------
-- 4. Documents Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "documents_select_all_roles" ON documents
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "documents_insert_accountant_owner" ON documents
    FOR INSERT TO authenticated
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

CREATE POLICY "documents_update_accountant_owner" ON documents
    FOR UPDATE TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

CREATE POLICY "documents_delete_owner" ON documents
    FOR DELETE TO authenticated
    USING (auth_org_role(org_id) = 'owner');

-- ------------------------------------------------------------------------------
-- 5. Extractions Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "extractions_select_all_roles" ON extractions
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "extractions_write_accountant_owner" ON extractions
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

-- ------------------------------------------------------------------------------
-- 6. Bank Transactions Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "bank_tx_select_all_roles" ON bank_transactions
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "bank_tx_write_accountant_owner" ON bank_transactions
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

-- ------------------------------------------------------------------------------
-- 7. Matches Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "matches_select_all_roles" ON matches
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "matches_write_accountant_owner" ON matches
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

-- ------------------------------------------------------------------------------
-- 8. Flags Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "flags_select_all_roles" ON flags
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "flags_write_accountant_owner" ON flags
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

-- ------------------------------------------------------------------------------
-- 9. Audit Log Policies (Append only, read by members, never updated/deleted)
-- ------------------------------------------------------------------------------
CREATE POLICY "audit_log_select_members" ON audit_log
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "audit_log_insert" ON audit_log
    FOR INSERT TO authenticated
    WITH CHECK (is_org_member(org_id));

-- ------------------------------------------------------------------------------
-- 10. Usage Events Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "usage_events_select" ON usage_events
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

-- ------------------------------------------------------------------------------
-- 11. API Keys Policies (Owners only)
-- ------------------------------------------------------------------------------
CREATE POLICY "api_keys_owner_only" ON api_keys
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) = 'owner')
    WITH CHECK (auth_org_role(org_id) = 'owner');
-- ==============================================================================
-- Migration: 20261005000006_audit_hash_chain.sql
-- Description: Automatic SHA-256 cryptographic hash chaining trigger for audit_log
--              Serialized per organization via PostgreSQL transaction advisory lock
-- ==============================================================================

CREATE OR REPLACE FUNCTION trg_audit_log_compute_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash CHAR(64);
    payload TEXT;
BEGIN
    -- Acquire transaction-level advisory lock on the organization's hash ID
    -- This serializes concurrent audit entries for the same org, preventing chain forks
    PERFORM pg_advisory_xact_lock(hashtext(NEW.org_id::text));

    -- Fetch the previous hash in this organization's ledger chain
    SELECT entry_hash INTO last_hash
    FROM audit_log
    WHERE org_id = NEW.org_id
    ORDER BY id DESC
    LIMIT 1;

    -- If first entry for this org, use zero Genesis hash
    IF last_hash IS NULL THEN
        last_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    NEW.prev_hash := last_hash;

    -- Concat payload components for cryptographic hash
    payload := last_hash || ':' ||
               NEW.org_id::text || ':' ||
               NEW.action || ':' ||
               NEW.entity_type || ':' ||
               NEW.entity_id || ':' ||
               NEW.details::text || ':' ||
               COALESCE(NEW.actor_id::text, 'system');

    -- Compute SHA-256 entry hash
    NEW.entry_hash := encode(digest(payload, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_before_insert ON audit_log;
CREATE TRIGGER trg_audit_log_before_insert
BEFORE INSERT ON audit_log
FOR EACH ROW
EXECUTE FUNCTION trg_audit_log_compute_hash();
-- ==============================================================================
-- Migration: 20261005000007_duplicate_document_check.sql
-- Description: Helper function for friendly duplicate document detection before insert
-- ==============================================================================

CREATE OR REPLACE FUNCTION check_duplicate_document(
    p_org_id UUID,
    p_content_hash CHAR(64)
)
RETURNS TABLE (
    is_duplicate BOOLEAN,
    existing_id UUID,
    existing_file_name TEXT,
    uploaded_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE AS is_duplicate,
        d.id AS existing_id,
        d.file_name AS existing_file_name,
        d.created_at AS uploaded_at
    FROM documents d
    WHERE d.org_id = p_org_id AND d.content_hash = p_content_hash
    LIMIT 1;

    -- If no row found, returns empty result
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
-- ==============================================================================
-- Migration: 20261005000008_storage_documents_bucket.sql
-- Description: Private 'documents' bucket + org-scoped storage RLS policies (5.3)
--              Path convention: <org_id>/<document_id>/original.<ext>
-- ==============================================================================

-- Safe cast: a non-uuid first folder must return NULL (denying access), not raise an exception.
CREATE OR REPLACE FUNCTION public.safe_uuid(p text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Ensure get_org_role is callable with the expected signature
CREATE OR REPLACE FUNCTION public.get_org_role(target_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth_org_role(target_org_id);
$$;

DO $storage$
BEGIN
  IF to_regnamespace('storage') IS NULL THEN
    RAISE NOTICE 'storage schema not present; skipping bucket and policies';
    RETURN;
  END IF;

  -- Private bucket with 10MB limit and allowed mimes
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'documents', 'documents', false, 10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'text/csv']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = 10485760,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

  -- Idempotent policy setup on storage.objects
  EXECUTE 'DROP POLICY IF EXISTS documents_select_member ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS documents_insert_writer ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS documents_delete_owner ON storage.objects';

  -- READ: any active member of the organization identified by the first path segment
  EXECUTE $q$
    CREATE POLICY documents_select_member ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'documents'
      AND public.is_org_member(public.safe_uuid((storage.foldername(name))[1]))
    )
  $q$;

  -- UPLOAD: owner or accountant only (viewers are read-only)
  EXECUTE $q$
    CREATE POLICY documents_insert_writer ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND public.get_org_role(public.safe_uuid((storage.foldername(name))[1]))::text
          IN ('owner', 'accountant')
    )
  $q$;

  -- DELETE: owner only
  EXECUTE $q$
    CREATE POLICY documents_delete_owner ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'documents'
      AND public.get_org_role(public.safe_uuid((storage.foldername(name))[1]))::text = 'owner'
    )
  $q$;

  -- NOTE: No UPDATE policy on purpose. Stored objects are strictly immutable (default deny).
END
$storage$;

-- Align public.documents table columns for the two-phase upload & validation flow
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents
  ALTER COLUMN status SET DEFAULT 'pending_validation',
  ALTER COLUMN file_path DROP NOT NULL,
  ALTER COLUMN file_name DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL,
  ALTER COLUMN file_size_bytes DROP NOT NULL,
  ALTER COLUMN content_hash DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'skipped',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('pending_validation', 'validated', 'rejected', 'uploaded', 'queued', 'extracting', 'extracted', 'failed'));
