'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

export interface RetryExtractionResult {
  success: boolean;
  error?: string;
  newVersion?: number;
}

/**
 * Retries extraction for a failed or stuck document.
 * Increments extraction_version and re-dispatches the Inngest event.
 */
export async function retryExtractionAction(
  documentId: string,
  orgId: string
): Promise<RetryExtractionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // Fetch document with RLS
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id, org_id, extraction_version, status')
    .eq('id', documentId)
    .eq('org_id', orgId)
    .single();

  if (fetchErr || !doc) {
    return { success: false, error: 'Document not found or access denied.' };
  }

  const nextVersion = (doc.extraction_version || 1) + 1;

  // Update document row
  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      status: 'queued',
      failure_reason: null,
      extraction_version: nextVersion,
    })
    .eq('id', documentId)
    .eq('org_id', orgId);

  if (updateErr) {
    return { success: false, error: `Failed to reset document status: ${updateErr.message}` };
  }

  // Re-enqueue event with new extractionVersion to satisfy idempotency
  try {
    await inngest.send({
      name: 'document/validated',
      data: {
        documentId,
        orgId,
        version: nextVersion,
      },
    });
  } catch (queueErr) {
    console.error('Failed to dispatch retry event to inngest:', queueErr);
    await supabase
      .from('documents')
      .update({
        status: 'failed',
        failure_reason: 'queue_unavailable: Background processing queue is unreachable or not configured.',
      })
      .eq('id', documentId)
      .eq('org_id', orgId);

    return { success: false, error: 'queue_unavailable: Background processing queue is unreachable or not configured.' };
  }

  return {
    success: true,
    newVersion: nextVersion,
  };
}
