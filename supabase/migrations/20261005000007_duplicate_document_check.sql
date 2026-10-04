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
