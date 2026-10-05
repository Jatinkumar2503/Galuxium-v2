'use server';

import { createServerSupabaseClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import {
  ALLOWED_MIME_TYPES,
  MAX_SIZE_BYTES,
  validateFinalObject,
  sanitizeFilename,
} from './validation';
import { checkUploadRateLimit, checkUploadRateLimitDurable, rateTracker } from './rate-limit';
export { checkUploadRateLimit, checkUploadRateLimitDurable, rateTracker };

export interface RequestUploadParams {
  orgId: string;
  declaredFilename: string;
  declaredMimeType: string;
  declaredSizeBytes: number;
}

export interface RequestUploadResult {
  success: boolean;
  error?: string;
  documentId?: string;
  signedUrl?: string;
  token?: string;
  path?: string;
}

export interface FinalizeUploadParams {
  orgId: string;
  documentId: string;
  storagePath: string;
  declaredMimeType: string;
  originalFilename: string;
}

export interface FinalizeUploadResult {
  success: boolean;
  error?: string;
  isDuplicate?: boolean;
  existingDocumentId?: string;
  status?: 'validated' | 'rejected';
  rejectionReason?: string;
}

/**
 * Step 1: Request Signed Upload URL (Server Action)
 * Executed under the authenticated user's session client so storage RLS is verified.
 */
export async function requestUploadAction(params: RequestUploadParams): Promise<RequestUploadResult> {
  const { orgId, declaredFilename, declaredMimeType, declaredSizeBytes } = params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Authentication required to initiate document upload.' };
  }

  // 1. Verify user has role 'owner' or 'accountant' in the org
  const { data: membership, error: memberError } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (memberError || !membership || !['owner', 'accountant'].includes(membership.role)) {
    return {
      success: false,
      error: 'Permission denied: only organization owners and accountants can upload documents.',
    };
  }

  // 2. Durable serverless rate limiting check (Section 4 & 5.10)
  const admin = createAdminClient();
  const rateLimit = await checkUploadRateLimitDurable(user.id, orgId, admin);
  if (!rateLimit.isAllowed) {
    return { success: false, error: rateLimit.error };
  }

  // 3. Allow-list validation (Section 2)
  const allowedValues = Object.values(ALLOWED_MIME_TYPES) as string[];
  if (!allowedValues.includes(declaredMimeType)) {
    return {
      success: false,
      error: `File type "${declaredMimeType}" is not supported. Allowed: PDF, JPEG, PNG, HEIC, CSV.`,
    };
  }

  const isCsv = declaredMimeType === ALLOWED_MIME_TYPES.csv;
  const maxBytes = isCsv ? MAX_SIZE_BYTES.bankStatement : MAX_SIZE_BYTES.invoice;
  if (declaredSizeBytes > maxBytes) {
    return {
      success: false,
      error: `Declared size exceeds maximum limit of ${maxBytes / (1024 * 1024)} MB.`,
    };
  }

  // 4. Generate document_id and path: <org_id>/<document_id>/original.<ext>
  const documentId = crypto.randomUUID();
  const ext =
    Object.keys(ALLOWED_MIME_TYPES).find(
      (k) => ALLOWED_MIME_TYPES[k as keyof typeof ALLOWED_MIME_TYPES] === declaredMimeType
    ) || 'bin';
  const storagePath = `${orgId}/${documentId}/original.${ext}`;
  const sanitizedName = sanitizeFilename(declaredFilename);

  // 5. Insert documents row with status = 'pending_validation'
  const { error: insertError } = await supabase.from('documents').insert({
    id: documentId,
    org_id: orgId,
    status: 'pending_validation',
    file_name: sanitizedName,
    file_path: storagePath,
    mime_type: declaredMimeType,
    file_size_bytes: declaredSizeBytes,
    uploaded_by: user.id,
  });

  if (insertError) {
    return {
      success: false,
      error: `Failed to initialize document entry: ${insertError.message}`,
    };
  }

  // 6. Create signed upload URL using the user session client (enforcing INSERT policy)
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .createSignedUploadUrl(storagePath);

  if (uploadError || !uploadData) {
    return {
      success: false,
      error: `Failed to generate signed upload URL: ${uploadError?.message || 'Storage error'}`,
    };
  }

  // 7. Audit log document upload request (Section 4)
  await admin.from('audit_log').insert({
    org_id: orgId,
    actor_id: user.id,
    action: 'document_upload_requested',
    entity_type: 'document',
    entity_id: documentId,
    details: {
      declaredMimeType,
      declaredSizeBytes,
      outcome: 'request_created',
    },
  });

  return {
    success: true,
    documentId,
    signedUrl: uploadData.signedUrl,
    token: uploadData.token,
    path: storagePath,
  };
}

/**
 * Step 2: Finalize Upload and Run Server-Side Validation (Server Action)
 * Reads the uploaded binary from Supabase Storage and performs the full validation suite.
 */
export async function finalizeUploadAction(params: FinalizeUploadParams): Promise<FinalizeUploadResult> {
  const { orgId, documentId, storagePath, declaredMimeType, originalFilename } = params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized.' };
  }

  // Re-verify membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'accountant'].includes(membership.role)) {
    return { success: false, error: 'Unauthorized role.' };
  }

  // Download stored object from Supabase Storage using session client
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (downloadError || !fileBlob) {
    // Record rejected state
    await supabase
      .from('documents')
      .update({
        status: 'rejected',
        rejection_reason: 'Uploaded object not found in storage repository.',
      })
      .eq('id', documentId)
      .eq('org_id', orgId);

    return {
      success: false,
      error: 'Uploaded document could not be retrieved from storage for validation.',
    };
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Run complete validation pipeline (Section 3: in order, stop at first failure)
  const validation = await validateFinalObject({
    buffer,
    declaredMime: declaredMimeType,
    originalFilename,
  });

  if (!validation.isValid) {
    // Delete invalid object from storage repository
    await supabase.storage.from('documents').remove([storagePath]);

    // Update document row to rejected
    await supabase
      .from('documents')
      .update({
        status: 'rejected',
        rejection_reason: validation.error,
      })
      .eq('id', documentId)
      .eq('org_id', orgId);

    // Audit log rejection (Section 4)
    const admin = createAdminClient();
    await admin.from('audit_log').insert({
      org_id: orgId,
      actor_id: user.id,
      action: 'document_rejected',
      entity_type: 'document',
      entity_id: documentId,
      details: {
        reason: validation.error,
        declaredMimeType,
        sizeBytes: buffer.length,
      },
    });

    return {
      success: false,
      status: 'rejected',
      rejectionReason: validation.error,
      error: validation.error,
    };
  }

  // Check duplicate hash constraint (Section 3.6)
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, file_name, created_at')
    .eq('org_id', orgId)
    .eq('content_hash', validation.contentHash!)
    .neq('id', documentId)
    .eq('status', 'validated')
    .maybeSingle();

  if (existingDoc) {
    // Exact duplicate found
    await supabase.storage.from('documents').remove([storagePath]);

    const duplicateMsg = 'This file was already uploaded';
    await supabase
      .from('documents')
      .update({
        status: 'rejected',
        rejection_reason: `${duplicateMsg} (Document ID: ${existingDoc.id})`,
      })
      .eq('id', documentId)
      .eq('org_id', orgId);

    // Audit log duplicate rejection
    const admin = createAdminClient();
    await admin.from('audit_log').insert({
      org_id: orgId,
      actor_id: user.id,
      action: 'document_duplicate_blocked',
      entity_type: 'document',
      entity_id: documentId,
      details: {
        existingId: existingDoc.id,
        contentHash: validation.contentHash,
      },
    });

    return {
      success: false,
      isDuplicate: true,
      existingDocumentId: existingDoc.id,
      status: 'rejected',
      rejectionReason: duplicateMsg,
      error: duplicateMsg,
    };
  }

  // Valid, non-duplicate upload: Update document row to 'validated'
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      status: 'validated',
      mime_type: validation.detectedMime,
      file_path: storagePath,
      file_name: validation.sanitizedFilename,
      file_size_bytes: buffer.length,
      page_count: validation.pageCount || null,
      content_hash: validation.contentHash,
      scan_status: 'skipped', // Per Section 6: record skipped
    })
    .eq('id', documentId)
    .eq('org_id', orgId);

  if (updateError) {
    return {
      success: false,
      error: `Failed to commit document validation: ${updateError.message}`,
    };
  }

  // Record audit log & usage events (Section 4)
  const admin = createAdminClient();
  await admin.from('audit_log').insert({
    org_id: orgId,
    actor_id: user.id,
    action: 'document_uploaded',
    entity_type: 'document',
    entity_id: documentId,
    details: {
      filename: validation.sanitizedFilename,
      mimeType: validation.detectedMime,
      sizeBytes: buffer.length,
      pageCount: validation.pageCount,
      contentHash: validation.contentHash,
    },
  });

  await admin.from('usage_events').insert({
    org_id: orgId,
    event_type: 'document_processed',
    quantity: 1,
    cost_cents: 0.05,
    metadata: {
      documentId,
      mimeType: validation.detectedMime,
      sizeBytes: buffer.length,
    },
  });

  return {
    success: true,
    status: 'validated',
  };
}

/**
 * Step 3: View or Download Document with Short-Lived Signed URL (Section 5)
 * Never exposes a public URL. Validates org membership and expires in 300s.
 */
export async function getSignedDocumentUrlAction(params: {
  orgId: string;
  documentId: string;
  isDownload?: boolean;
}): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const { orgId, documentId, isDownload } = params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required.' };
  }

  // Re-check membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { success: false, error: 'Cross-tenant access forbidden.' };
  }

  // Query document storage path
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('file_path, file_name')
    .eq('id', documentId)
    .eq('org_id', orgId)
    .single();

  if (docError || !doc?.file_path) {
    return { success: false, error: 'Document not found.' };
  }

  const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 300, {
    download: isDownload ? doc.file_name || true : false,
  });

  if (error || !data) {
    return { success: false, error: 'Failed to generate signed document URL.' };
  }

  return { success: true, signedUrl: data.signedUrl };
}

/**
 * Step 4: Cleanup Abandoned Uploads (Section 1.4)
 * Cleans up pending_validation rows older than 1 hour.
 */
export async function cleanupAbandonedUploadsAction(): Promise<{ cleanedCount: number }> {
  const admin = createAdminClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: abandonedDocs } = await admin
    .from('documents')
    .select('id, org_id, file_path')
    .eq('status', 'pending_validation')
    .lt('created_at', oneHourAgo);

  if (!abandonedDocs || abandonedDocs.length === 0) {
    return { cleanedCount: 0 };
  }

  const pathsToDelete = abandonedDocs.map((d) => d.file_path).filter(Boolean) as string[];
  if (pathsToDelete.length > 0) {
    await admin.storage.from('documents').remove(pathsToDelete);
  }

  const idsToReject = abandonedDocs.map((d) => d.id);
  await admin
    .from('documents')
    .update({
      status: 'rejected',
      rejection_reason: 'abandoned',
    })
    .in('id', idsToReject);

  return { cleanedCount: abandonedDocs.length };
}
