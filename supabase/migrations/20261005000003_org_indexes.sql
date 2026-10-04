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
