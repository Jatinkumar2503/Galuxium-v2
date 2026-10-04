# Galuxium Nexus V2: Database Schema Specification

## Architecture Overview
The Galuxium Nexus V2 schema is built for strict multi-tenancy, immutable compliance auditing, and Indian GST tax reconciliation. Every tenant table is bound to `org_id` with foreign key cascades and B-tree indexing.

---

## Tables Overview

### 1. `organizations`
Primary tenant entity representing an SME, enterprise, or accounting agency.
- `id` (UUID, PK, `gen_random_uuid()`)
- `name` (TEXT, NOT NULL)
- `slug` (TEXT, UNIQUE, NOT NULL)
- `gstin` (VARCHAR(15), NULL, CHECK regex for Indian GST format: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`)
- `pan` (VARCHAR(10), NULL, CHECK regex: `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`)
- `plan` (TEXT, NOT NULL, DEFAULT 'free', CHECK `plan IN ('free', 'pro', 'enterprise')`)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())

### 2. `memberships`
Join table connecting authenticated users (`auth.users`) to organizations with role-based access.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `user_id` (UUID, FK -> `auth.users.id` ON DELETE CASCADE)
- `role` (TEXT, NOT NULL, CHECK `role IN ('owner', 'accountant', 'viewer')`)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- UNIQUE(`org_id`, `user_id`)

### 3. `clients`
SME client businesses managed by an accounting firm organization.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `name` (TEXT, NOT NULL)
- `gstin` (VARCHAR(15), NULL)
- `state_code` (VARCHAR(2), NOT NULL)
- `email` (TEXT)
- `phone` (VARCHAR(15))
- `status` (TEXT, NOT NULL, DEFAULT 'active', CHECK `status IN ('active', 'archived')`)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### 4. `documents`
Uploaded vendor bills, tax invoices, debit notes, and bank receipts.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `client_id` (UUID, FK -> `clients.id` ON DELETE SET NULL)
- `file_path` (TEXT, NOT NULL)
- `file_name` (TEXT, NOT NULL)
- `mime_type` (TEXT, NOT NULL)
- `file_size_bytes` (BIGINT, NOT NULL)
- `content_hash` (CHAR(64), NOT NULL) -- SHA-256 for exact duplicate detection
- `status` (TEXT, NOT NULL, DEFAULT 'uploaded', CHECK `status IN ('uploaded', 'queued', 'extracting', 'extracted', 'validated', 'failed')`)
- `uploaded_by` (UUID, FK -> `auth.users.id`)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- UNIQUE(`org_id`, `content_hash`)

### 5. `extractions`
Structured invoice JSON data extracted by multimodal AI and verified against GST arithmetic.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `document_id` (UUID, FK -> `documents.id` ON DELETE CASCADE, UNIQUE)
- `vendor_name` (TEXT, NOT NULL)
- `vendor_gstin` (VARCHAR(15))
- `buyer_gstin` (VARCHAR(15))
- `invoice_number` (TEXT, NOT NULL)
- `invoice_date` (DATE, NOT NULL)
- `due_date` (DATE)
- `currency` (VARCHAR(3), NOT NULL, DEFAULT 'INR')
- `taxable_amount` (NUMERIC(14, 2), NOT NULL)
- `cgst_amount` (NUMERIC(14, 2), DEFAULT 0)
- `sgst_amount` (NUMERIC(14, 2), DEFAULT 0)
- `igst_amount` (NUMERIC(14, 2), DEFAULT 0)
- `total_tax_amount` (NUMERIC(14, 2), NOT NULL)
- `total_amount` (NUMERIC(14, 2), NOT NULL)
- `line_items` (JSONB, NOT NULL, DEFAULT '[]'::jsonb)
- `confidence_score` (NUMERIC(5, 4), NOT NULL) -- 0.0000 to 1.0000
- `field_confidences` (JSONB, NOT NULL, DEFAULT '{}'::jsonb)
- `raw_model_output` (JSONB)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### 6. `bank_transactions`
Imported bank statement records from CSV / API feeds.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `client_id` (UUID, FK -> `clients.id` ON DELETE SET NULL)
- `transaction_date` (DATE, NOT NULL)
- `value_date` (DATE)
- `description` (TEXT, NOT NULL)
- `reference_number` (TEXT) -- UTR / Cheque / IMPS number
- `debit_amount` (NUMERIC(14, 2), DEFAULT 0)
- `credit_amount` (NUMERIC(14, 2), DEFAULT 0)
- `balance` (NUMERIC(14, 2))
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### 7. `matches`
Reconciliation pairings between documents and bank transactions.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `document_id` (UUID, FK -> `documents.id` ON DELETE CASCADE)
- `transaction_id` (UUID, FK -> `bank_transactions.id` ON DELETE CASCADE)
- `match_score` (NUMERIC(5, 4), NOT NULL) -- 0.0000 to 1.0000
- `match_type` (TEXT, NOT NULL, CHECK `match_type IN ('exact', 'fuzzy_rule', 'llm_assisted', 'manual')`)
- `status` (TEXT, NOT NULL, DEFAULT 'pending_review', CHECK `status IN ('auto_approved', 'pending_review', 'approved', 'rejected')`)
- `reviewer_id` (UUID, FK -> `auth.users.id`)
- `review_notes` (TEXT)
- `reviewed_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### 8. `flags`
Compliance warnings, tax discrepancies, and anomaly alerts.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `document_id` (UUID, FK -> `documents.id` ON DELETE CASCADE)
- `transaction_id` (UUID, FK -> `bank_transactions.id` ON DELETE SET NULL)
- `flag_type` (TEXT, NOT NULL, CHECK `flag_type IN ('duplicate_invoice', 'gstin_invalid', 'tax_mismatch', 'date_outlier', 'amount_mismatch', 'split_payment')`)
- `severity` (TEXT, NOT NULL, CHECK `severity IN ('info', 'warning', 'critical')`)
- `explanation` (TEXT, NOT NULL) -- Plain-English reason for non-technical users
- `is_resolved` (BOOLEAN, NOT NULL, DEFAULT false)
- `resolved_by` (UUID, FK -> `auth.users.id`)
- `resolution_notes` (TEXT)
- `resolved_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### 9. `audit_log`
Immutable, append-only cryptographic ledger of all security, matching, and compliance actions.
- `id` (BIGSERIAL, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `actor_id` (UUID, FK -> `auth.users.id`)
- `action` (TEXT, NOT NULL)
- `entity_type` (TEXT, NOT NULL)
- `entity_id` (TEXT, NOT NULL)
- `details` (JSONB, NOT NULL, DEFAULT '{}'::jsonb)
- `ip_address` (INET)
- `user_agent` (TEXT)
- `prev_hash` (CHAR(64)) -- SHA-256 hash chaining
- `entry_hash` (CHAR(64), NOT NULL) -- SHA-256(prev_hash + id + org_id + action + details)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())

### 10. `usage_events`
Metered billing events for API calls, extraction tokens, and storage consumption.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `event_type` (TEXT, NOT NULL, CHECK `event_type IN ('document_processed', 'api_call', 'llm_tokens', 'storage_bytes')`)
- `quantity` (BIGINT, NOT NULL, DEFAULT 1)
- `cost_cents` (NUMERIC(10, 4), NOT NULL, DEFAULT 0)
- `latency_ms` (INTEGER)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### 11. `api_keys`
Hashed programmatic credentials for accounting software integration.
- `id` (UUID, PK)
- `org_id` (UUID, FK -> `organizations.id` ON DELETE CASCADE)
- `name` (TEXT, NOT NULL)
- `key_hash` (CHAR(64), NOT NULL, UNIQUE) -- SHA-256 of raw secret
- `key_prefix` (VARCHAR(12), NOT NULL) -- e.g. `glx_live_`
- `scopes` (TEXT[], NOT NULL, DEFAULT ARRAY['read:invoices'])
- `rate_limit_rpm` (INTEGER, NOT NULL, DEFAULT 60)
- `last_used_at` (TIMESTAMPTZ)
- `is_revoked` (BOOLEAN, NOT NULL, DEFAULT false)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### 12. `auth_failed_attempts` (Lockout Protection - Instruction 3.5)
Custom table managing progressive login lockouts without reliance on external services.
- `id` (UUID, PK)
- `email` (TEXT NOT NULL)
- `ip_address` (INET NOT NULL)
- `consecutive_failures` (INTEGER NOT NULL DEFAULT 1)
- `locked_until` (TIMESTAMPTZ)
- `last_attempt_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
- UNIQUE(`email`, `ip_address`)
