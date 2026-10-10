import { NonRetriableError } from 'inngest';
import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';
import { defaultExtractor } from '@/lib/ai/extractor';
import { runDeterministicChecks } from '@/lib/ai/verification';
import { evaluateConfidence } from '@/lib/ai/confidence';
import { calculateExtractionCostMicros } from '@/lib/ai/pricing';
import { redactPii, sanitizeLogData } from '@/lib/ai/pii';

export const extractDocument = inngest.createFunction(
  {
    id: 'extract-document',
    // Concurrency: Max 3 running per organization (Phase 6.1)
    concurrency: {
      limit: 3,
      key: 'event.data.orgId',
    },
    // Idempotency: documentId:extractionVersion (Phase 6.1)
    idempotency: 'event.data.documentId + ":" + (event.data.version || 1)',
    retries: 3,
    // Dead-letter handler on terminal failure
    onFailure: async ({ event, error }) => {
      const { documentId, orgId } = event.data.event.data;
      const adminClient = createAdminClient();
      const sanitizedError = redactPii(error?.message || 'Extraction failed permanently');

      // Set document status to failed and store failure reason
      await adminClient
        .from('documents')
        .update({
          status: 'failed',
          failure_reason: sanitizedError.substring(0, 500),
        })
        .eq('id', documentId)
        .eq('org_id', orgId);

      // Record immutable audit entry
      await adminClient.from('audit_log').insert({
        org_id: orgId,
        action: 'document_extraction_failed',
        entity_type: 'document',
        entity_id: documentId,
        actor_id: null,
        actor_role: 'system',
        severity: 'error',
        details: sanitizeLogData({
          error: sanitizedError,
          documentId,
        }),
      });
    },
    triggers: [{ event: 'document/validated' }],
  },
  async ({ event, step }) => {
    const { documentId, orgId } = event.data;
    const version = event.data.version || 1;

    // STEP 1: LOAD & CHECK (Status: extracting)
    const docData = await step.run('load-document', async () => {
      const adminClient = createAdminClient();

      // Check daily extraction cap guardrail (Phase 6.8, default 100)
      const dailyCap = parseInt(process.env.DAILY_EXTRACTION_CAP || '100', 10);
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const { count: dailyUsageCount } = await adminClient
        .from('usage_events')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('event_type', 'extraction')
        .gte('created_at', startOfDay.toISOString());

      if ((dailyUsageCount || 0) >= dailyCap) {
        throw new NonRetriableError(
          `Organization daily extraction cap of ${dailyCap} documents reached. Please upgrade quota.`
        );
      }

      // Fetch document row (scoped strictly by org_id from database row)
      const { data: doc, error: docErr } = await adminClient
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('org_id', orgId)
        .single();

      if (docErr || !doc) {
        throw new NonRetriableError(`Document ${documentId} not found in org ${orgId}`);
      }

      // Check idempotency: if already extracted for this version, skip
      const { data: existingExtraction } = await adminClient
        .from('extractions')
        .select('id')
        .eq('document_id', documentId)
        .eq('version', version)
        .maybeSingle();

      if (existingExtraction) {
        return { isAlreadyExtracted: true, doc };
      }

      // Transition status: validated -> queued -> extracting
      await adminClient
        .from('documents')
        .update({
          status: 'extracting',
          failure_reason: null,
        })
        .eq('id', documentId)
        .eq('org_id', orgId);

      return { isAlreadyExtracted: false, doc };
    });

    if (docData.isAlreadyExtracted) {
      return { success: true, message: 'Document already extracted for this version.' };
    }

    // STEP 2: EXTRACT (AI Provider with prompt injection defense & repair loop)
    const rawResult = await step.run('extract-ai', async () => {
      const adminClient = createAdminClient();
      const doc = docData.doc;

      // Download document binary from Supabase Storage (scoped to org_id)
      const { data: fileBlob, error: downloadErr } = await adminClient.storage
        .from('documents')
        .download(doc.file_path);

      if (downloadErr || !fileBlob) {
        throw new NonRetriableError(
          `Failed to download document from storage: ${downloadErr?.message || 'File not found'}`
        );
      }

      const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

      try {
        return await defaultExtractor.extractInvoice({
          fileBuffer,
          mimeType: doc.mime_type,
          fileName: doc.file_name,
          orgId,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'AI Extraction failed';
        // Permanent format, missing config, or unreadable errors should not retry indefinitely
        if (
          msg.includes('validation after') ||
          msg.includes('unreadable') ||
          msg.includes('MODEL_NOT_CONFIGURED')
        ) {
          throw new NonRetriableError(msg);
        }
        throw err; // Transient errors (429, 5xx) will be retried automatically by Inngest
      }
    });

    // STEP 3: VALIDATE & EVALUATE CONFIDENCE (Pure deterministic checks)
    const validatedData = await step.run('validate-deterministic', async () => {
      const issues = runDeterministicChecks(rawResult.data);
      const confidence = evaluateConfidence(rawResult.data.field_confidences, issues);

      return {
        fields: rawResult.data,
        issues,
        overallConfidence: confidence.overallConfidence,
        needsReview: confidence.needsReview,
      };
    });

    // STEP 4: SAVE EXTRACTION, USAGE & AUDIT LOG (Status: extracted)
    await step.run('save-extraction', async () => {
      const adminClient = createAdminClient();

      // Insert into extractions table
      const { error: insertErr } = await adminClient.from('extractions').insert({
        org_id: orgId,
        document_id: documentId,
        version,
        fields: validatedData.fields,
        overall_confidence: validatedData.overallConfidence,
        needs_review: validatedData.needsReview,
        issues: validatedData.issues,
        model: rawResult.model,
        prompt_version: rawResult.promptVersion,
        input_tokens: rawResult.inputTokens,
        output_tokens: rawResult.outputTokens,
        latency_ms: rawResult.latencyMs,
      });

      if (insertErr) {
        throw new Error(`Failed to save extraction record: ${insertErr.message}`);
      }

      // Update document status to extracted
      await adminClient
        .from('documents')
        .update({
          status: 'extracted',
          failure_reason: null,
        })
        .eq('id', documentId)
        .eq('org_id', orgId);

      // Compute metered cost (Phase 6.8)
      const costMicros = calculateExtractionCostMicros(
        rawResult.model,
        rawResult.inputTokens,
        rawResult.outputTokens
      );

      // Record metered usage event
      await adminClient.from('usage_events').insert({
        org_id: orgId,
        event_type: 'extraction',
        quantity: 1,
        metadata: {
          model: rawResult.model,
          input_tokens: rawResult.inputTokens,
          output_tokens: rawResult.outputTokens,
          latency_ms: rawResult.latencyMs,
          cost_micros: costMicros,
          document_id: documentId,
        },
      });

      // Write immutable audit log entry
      await adminClient.from('audit_log').insert({
        org_id: orgId,
        action: 'document_extracted',
        entity_type: 'document',
        entity_id: documentId,
        actor_id: null,
        actor_role: 'system',
        severity: validatedData.needsReview ? 'warning' : 'info',
        details: sanitizeLogData({
          documentId,
          version,
          overallConfidence: validatedData.overallConfidence,
          needsReview: validatedData.needsReview,
          issuesCount: validatedData.issues.length,
          model: rawResult.model,
        }),
      });
    });

    return {
      success: true,
      documentId,
      overallConfidence: validatedData.overallConfidence,
      needsReview: validatedData.needsReview,
    };
  }
);
