import type { SupabaseClient } from '@supabase/supabase-js';

// In-memory rate limiting tracker (fallback and unit testing)
export interface RateTracker {
  userRequests: Map<string, number[]>; // userId -> timestamp[]
  orgDailyRequests: Map<string, { count: number; date: string }>;
}

export const rateTracker: RateTracker = {
  userRequests: new Map(),
  orgDailyRequests: new Map(),
};

/**
 * In-memory rate limit checker (for fast local simulation or offline tests).
 */
export function checkUploadRateLimit(
  userId: string,
  orgId: string
): { isAllowed: boolean; error?: string } {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;
  const today = new Date().toISOString().split('T')[0];

  // 1. User limit: 30 per 10 minutes
  const timestamps = (rateTracker.userRequests.get(userId) || []).filter(
    (t) => t > tenMinutesAgo
  );
  if (timestamps.length >= 30) {
    return {
      isAllowed: false,
      error:
        'Upload rate limit exceeded: maximum 30 uploads per 10 minutes. Please wait before retrying.',
    };
  }
  timestamps.push(now);
  rateTracker.userRequests.set(userId, timestamps);

  // 2. Org limit: 200 per day
  const orgRecord = rateTracker.orgDailyRequests.get(orgId);
  if (orgRecord && orgRecord.date === today) {
    if (orgRecord.count >= 200) {
      return {
        isAllowed: false,
        error:
          'Organization daily upload quota reached (200 documents/day). Upgrade plan or contact support.',
      };
    }
    orgRecord.count += 1;
  } else {
    rateTracker.orgDailyRequests.set(orgId, { count: 1, date: today });
  }

  return { isAllowed: true };
}

/**
 * Serverless-durable rate limit checker backed by PostgreSQL audit_log (Section 4 & 5.10).
 * Survives serverless cold starts and multi-instance concurrency across edge workers.
 */
export async function checkUploadRateLimitDurable(
  userId: string,
  orgId: string,
  supabaseClient?: SupabaseClient
): Promise<{ isAllowed: boolean; error?: string }> {
  // If no Supabase client is supplied (e.g. running in purely local unit tests), use in-memory tracker
  if (!supabaseClient) {
    return checkUploadRateLimit(userId, orgId);
  }

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. User upload requests in last 10 minutes
    const { count: userUploadCount, error: userError } = await supabaseClient
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('actor_id', userId)
      .eq('action', 'document_upload_requested')
      .gte('created_at', tenMinutesAgo);

    if (!userError && userUploadCount !== null && userUploadCount >= 30) {
      return {
        isAllowed: false,
        error:
          'Upload rate limit exceeded: maximum 30 uploads per 10 minutes. Please wait before retrying.',
      };
    }

    // 2. Org upload requests in last 24 hours
    const { count: orgUploadCount, error: orgError } = await supabaseClient
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('action', 'document_upload_requested')
      .gte('created_at', twentyFourHoursAgo);

    if (!orgError && orgUploadCount !== null && orgUploadCount >= 200) {
      return {
        isAllowed: false,
        error:
          'Organization daily upload quota reached (200 documents/day). Upgrade plan or contact support.',
      };
    }

    // Also mirror to memory for defense-in-depth within instance
    checkUploadRateLimit(userId, orgId);

    return { isAllowed: true };
  } catch {
    // Fallback gracefully to in-memory tracking if DB count query fails
    return checkUploadRateLimit(userId, orgId);
  }
}
