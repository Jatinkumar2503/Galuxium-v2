-- ==============================================================================
-- Migration: 20261005000009_storage_documents_hardening.sql
-- Description: Hardened document ingestion schema & storage RLS policies (Phase 5)
--
-- Fixes & Hardening Applied:
-- 1. Calls public.auth_org_role directly in storage policies without wrapping or redefining get_org_role.
-- 2. Removes any stray get_org_role function if it was previously created.
-- 3. Cleans up invalid dev test rows with NULLs before enforcing NOT NULL.
-- 4. Preserves NOT NULL on canonical columns (file_path, file_name, mime_type, file_size_bytes).
-- 5. Removes redundant columns (original_filename, size_bytes, storage_path) and reuses canonical columns.
-- 6. content_hash is nullable only while status is pending_validation/rejected; validated rows require complete metadata.
-- 7. Adds B-Tree composite indexes on audit_log for fast durable rate-limiting queries.
-- 8. Safe UUID parser specifies SET search_path = pg_catalog, public to prevent search_path hijacking.
-- ==============================================================================

-- 1. Safe cast helper: Non-UUID first path component returns NULL (denying access), never raises exception
CREATE OR REPLACE FUNCTION public.safe_uuid(p text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN p::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 2. Drop legacy get_org_role if it was previously defined or pasted
DROP FUNCTION IF EXISTS public.get_org_role(uuid);

-- 3. Storage Bucket and Object RLS Policies
DO $storage$
BEGIN
  IF to_regnamespace('storage') IS NULL THEN
    RAISE NOTICE 'storage schema not present; skipping bucket and policies';
    RETURN;
  END IF;

  -- Ensure private 'documents' bucket with 10MB limit and allowed MIME types
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'documents', 'documents', false, 10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'text/csv']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = 10485760,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

  -- Idempotently reset policies on storage.objects
  EXECUTE 'DROP POLICY IF EXISTS documents_select_member ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS documents_insert_writer ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS documents_delete_owner ON storage.objects';

  -- READ: Any active member of the organization identified by the first folder in storage path
  EXECUTE $q$
    CREATE POLICY documents_select_member ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'documents'
      AND public.is_org_member(public.safe_uuid((storage.foldername(name))[1]))
    )
  $q$;

  -- UPLOAD: Organization owner or accountant only (call public.auth_org_role directly)
  EXECUTE $q$
    CREATE POLICY documents_insert_writer ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND public.auth_org_role(public.safe_uuid((storage.foldername(name))[1]))
          IN ('owner', 'accountant')
    )
  $q$;

  -- DELETE: Organization owner only (call public.auth_org_role directly)
  EXECUTE $q$
    CREATE POLICY documents_delete_owner ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'documents'
      AND public.auth_org_role(public.safe_uuid((storage.foldername(name))[1])) = 'owner'
    )
  $q$;

  -- Objects are immutable by default: No UPDATE policy is created (default-deny)
END
$storage$;

-- 4. Public Documents Schema Hardening
-- Migrate data if duplicate columns were created during testing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'original_filename'
  ) THEN
    UPDATE public.documents SET file_name = original_filename WHERE (file_name IS NULL OR file_name = '') AND original_filename IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'storage_path'
  ) THEN
    UPDATE public.documents SET file_path = storage_path WHERE (file_path IS NULL OR file_path = '') AND storage_path IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'size_bytes'
  ) THEN
    UPDATE public.documents SET file_size_bytes = size_bytes WHERE (file_size_bytes IS NULL OR file_size_bytes = 0) AND size_bytes IS NOT NULL;
  END IF;
END $$;

-- Drop redundant duplicate columns
ALTER TABLE public.documents
  DROP COLUMN IF EXISTS original_filename,
  DROP COLUMN IF EXISTS size_bytes,
  DROP COLUMN IF EXISTS storage_path;

-- Clean up any invalid or abandoned dev test rows that have NULL in mandatory columns before enforcing NOT NULL
SET row_security = off;
DELETE FROM public.documents
WHERE file_path IS NULL OR file_name IS NULL OR mime_type IS NULL OR file_size_bytes IS NULL;

-- Enforce canonical columns and nullable content_hash during pending_validation
ALTER TABLE public.documents
  ALTER COLUMN status SET DEFAULT 'pending_validation',
  ALTER COLUMN file_path SET NOT NULL,
  ALTER COLUMN file_name SET NOT NULL,
  ALTER COLUMN mime_type SET NOT NULL,
  ALTER COLUMN file_size_bytes SET NOT NULL,
  ALTER COLUMN content_hash DROP NOT NULL;

-- Add required Phase 5 metadata columns
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'skipped',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Update status constraint to encompass the complete upload lifecycle
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('pending_validation', 'validated', 'rejected', 'uploaded', 'queued', 'extracting', 'extracted', 'failed'));

-- Add integrity constraint: validated rows MUST have content_hash and all canonical fields
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS check_validated_complete;

ALTER TABLE public.documents
  ADD CONSTRAINT check_validated_complete
  CHECK (
    status != 'validated' OR (
      content_hash IS NOT NULL AND
      file_path IS NOT NULL AND
      file_name IS NOT NULL AND
      mime_type IS NOT NULL AND
      file_size_bytes IS NOT NULL
    )
  );

-- 5. B-Tree Indexes on audit_log for Durable Rate-Limiting Queries (10m and 24h windows)
CREATE INDEX IF NOT EXISTS idx_audit_log_org_action_created
  ON public.audit_log (org_id, action, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_action_created
  ON public.audit_log (actor_id, action, created_at);
