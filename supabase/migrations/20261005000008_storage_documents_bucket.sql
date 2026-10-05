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
