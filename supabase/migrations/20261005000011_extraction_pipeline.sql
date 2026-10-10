-- Migration 20261005000011_extraction_pipeline.sql
-- Implements Phase 6.2 Extraction Schema, Versioning, Realtime publication, and RLS

-- 1. Extend documents table for extraction state lifecycle
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS extraction_version INTEGER NOT NULL DEFAULT 1;

-- 2. Ensure extraction table matches Phase 6.2 Specification
DROP TABLE IF EXISTS public.extractions CASCADE;

CREATE TABLE IF NOT EXISTS public.extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    fields JSONB NOT NULL,
    overall_confidence NUMERIC NOT NULL,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_document_extraction_version UNIQUE (document_id, version)
);

-- 3. High-performance tenant and lookup indexes
CREATE INDEX IF NOT EXISTS idx_extractions_org_id ON public.extractions(org_id);
CREATE INDEX IF NOT EXISTS idx_extractions_doc_version ON public.extractions(document_id, version);
CREATE INDEX IF NOT EXISTS idx_extractions_needs_review ON public.extractions(org_id, needs_review);

-- 4. Enable Row-Level Security on extractions
ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policy: Organization members can SELECT their extractions
-- Worker writes bypass RLS via server-side admin client; client modifications strictly disallowed.
CREATE POLICY extractions_select_member ON public.extractions
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

-- Explicitly disallow client-side mutations (fail closed)
DROP POLICY IF EXISTS extractions_insert_deny ON public.extractions;
DROP POLICY IF EXISTS extractions_update_deny ON public.extractions;
DROP POLICY IF EXISTS extractions_delete_deny ON public.extractions;

-- 6. Add documents to Supabase Realtime publication for Phase 6.10 Live Status UI
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'documents'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
    END IF;
  END IF;
END $$;
