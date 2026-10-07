-- ==============================================================================
-- File: supabase/preflight_check.sql
-- Description: Read-only combined preflight check for Phase 5 migration
-- Returns: Single JSONB cell containing all check results for easy 1-click copying.
-- ==============================================================================

SELECT jsonb_pretty(jsonb_build_object(
  'functions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'proname', p.proname,
      'prosecdef', p.prosecdef,
      'definition', pg_get_functiondef(p.oid)
    )), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('auth_org_role', 'get_org_role', 'is_org_member', 'safe_uuid')
  ),
  'null_rows', (
    SELECT count(*)
    FROM public.documents
    WHERE file_path IS NULL OR file_name IS NULL OR mime_type IS NULL OR file_size_bytes IS NULL
  ),
  'status_distribution', (
    SELECT coalesce(jsonb_object_agg(coalesce(status, 'NULL'), cnt), '{}'::jsonb)
    FROM (
      SELECT status, count(*) AS cnt
      FROM public.documents
      GROUP BY status
    ) s
  ),
  'validated_without_hash', (
    SELECT count(*)
    FROM public.documents
    WHERE status = 'validated' AND content_hash IS NULL
  ),
  'storage_policies', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'policyname', policyname,
      'cmd', cmd,
      'roles', roles,
      'qual', qual,
      'with_check', with_check
    )), '[]'::jsonb)
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  )
)) AS preflight_results;