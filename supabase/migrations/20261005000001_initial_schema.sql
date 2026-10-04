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
