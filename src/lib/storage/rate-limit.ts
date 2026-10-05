// In-memory rate limiting tracker (simulates distributed Redis / Edge KV)
export interface RateTracker {
  userRequests: Map<string, number[]>; // userId -> timestamp[]
  orgDailyRequests: Map<string, { count: number; date: string }>;
}

export const rateTracker: RateTracker = {
  userRequests: new Map(),
  orgDailyRequests: new Map(),
};

/**
 * Checks rate limits per Section 4:
 * 30 upload requests per user per 10 minutes, 200 per org per day.
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
