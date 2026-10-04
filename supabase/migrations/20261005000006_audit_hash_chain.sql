-- ==============================================================================
-- Migration: 20261005000006_audit_hash_chain.sql
-- Description: Automatic SHA-256 cryptographic hash chaining trigger for audit_log
-- ==============================================================================

CREATE OR REPLACE FUNCTION trg_audit_log_compute_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash CHAR(64);
    payload TEXT;
BEGIN
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
