-- ==============================================================================
-- Migration: 20261005000010_audit_log_seq.sql
-- Description: Add explicit monotonic sequence column to audit_log per organization,
--              enforce unique constraint (org_id, seq) to prevent forks,
--              and update SHA-256 chain trigger to serialize seq assignment inside advisory lock.
-- ==============================================================================

-- 1. Add seq column to audit_log
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS seq BIGINT;

-- 2. Backfill existing rows if any
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.audit_log WHERE seq IS NULL) THEN
        WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY created_at ASC, id ASC) AS rn
            FROM public.audit_log
        )
        UPDATE public.audit_log
        SET seq = numbered.rn
        FROM numbered
        WHERE public.audit_log.id = numbered.id AND public.audit_log.seq IS NULL;
    END IF;
END $$;

-- 3. Add unique constraint on (org_id, seq)
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_org_seq_unique;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_org_seq_unique UNIQUE (org_id, seq);

-- 4. Composite index for lightning-fast tip lookups ordered by seq DESC
CREATE INDEX IF NOT EXISTS idx_audit_log_org_seq ON public.audit_log (org_id, seq DESC);

-- 5. Update trg_audit_log_compute_hash() to assign seq monotonically inside advisory lock
CREATE OR REPLACE FUNCTION public.trg_audit_log_compute_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash CHAR(64);
    last_seq BIGINT;
    payload TEXT;
BEGIN
    -- Acquire transaction-level advisory lock on the organization's hash ID
    -- This serializes concurrent audit entries for the same org, preventing chain forks
    PERFORM pg_advisory_xact_lock(hashtext(NEW.org_id::text));

    -- Fetch the previous hash and sequence number in this organization's ledger chain
    SELECT entry_hash, seq INTO last_hash, last_seq
    FROM public.audit_log
    WHERE org_id = NEW.org_id
    ORDER BY seq DESC
    LIMIT 1;

    -- If first entry for this org, use zero Genesis hash and sequence 1
    IF last_hash IS NULL THEN
        last_hash := '0000000000000000000000000000000000000000000000000000000000000000';
        NEW.seq := 1;
    ELSE
        NEW.seq := COALESCE(last_seq, 0) + 1;
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
