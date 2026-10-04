import { createAdminClient } from '../supabase/admin.ts';

export interface LockoutStatus {
  isLocked: boolean;
  consecutiveFailures: number;
  lockDurationMinutes: number;
  requiresChallenge: boolean;
  remainingAttempts: number;
}

export interface IpRateLimitStatus {
  isAllowed: boolean;
  retryAfterSeconds?: number;
}

// In-memory cache fallback for high performance and local testing
const inMemoryAttempts = new Map<
  string,
  { failures: number; lockedUntil?: number; lastAttempt: number }
>();
const inMemoryIpLimits = new Map<string, { count: number; windowStart: number }>();

const MAX_FREE_FAILURES = 5;
const CHALLENGE_THRESHOLD = 3;

/**
 * Checks if a specific email + IP combination is currently locked out.
 */
export async function checkLoginRateLimit(
  email: string,
  ipAddress: string
): Promise<LockoutStatus> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `${normalizedEmail}:${ipAddress}`;
  const now = Date.now();

  const record = inMemoryAttempts.get(key);

  if (record && record.lockedUntil && now < record.lockedUntil) {
    const remainingMs = record.lockedUntil - now;
    const lockDurationMinutes = Math.ceil(remainingMs / 60000);
    return {
      isLocked: true,
      consecutiveFailures: record.failures,
      lockDurationMinutes,
      requiresChallenge: true,
      remainingAttempts: 0,
    };
  }

  const failures = record ? record.failures : 0;
  return {
    isLocked: false,
    consecutiveFailures: failures,
    lockDurationMinutes: 0,
    requiresChallenge: failures >= CHALLENGE_THRESHOLD,
    remainingAttempts: Math.max(0, MAX_FREE_FAILURES - failures),
  };
}

/**
 * Records a failed login attempt and updates progressive lockout timers:
 * - 5 failures: 1 minute
 * - 6 failures: 5 minutes
 * - 7+ failures: 15 minutes
 */
export async function recordFailedLoginAttempt(
  email: string,
  ipAddress: string
): Promise<LockoutStatus> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `${normalizedEmail}:${ipAddress}`;
  const now = Date.now();

  const existing = inMemoryAttempts.get(key);
  const failures = (existing ? existing.failures : 0) + 1;

  let lockDurationMinutes = 0;
  let lockedUntil: number | undefined = undefined;

  if (failures >= 7) {
    lockDurationMinutes = 15;
    lockedUntil = now + 15 * 60 * 1000;
  } else if (failures >= 6) {
    lockDurationMinutes = 5;
    lockedUntil = now + 5 * 60 * 1000;
  } else if (failures >= 5) {
    lockDurationMinutes = 1;
    lockedUntil = now + 1 * 60 * 1000;
  }

  inMemoryAttempts.set(key, {
    failures,
    lockedUntil,
    lastAttempt: now,
  });

  return {
    isLocked: failures >= MAX_FREE_FAILURES,
    consecutiveFailures: failures,
    lockDurationMinutes,
    requiresChallenge: failures >= CHALLENGE_THRESHOLD,
    remainingAttempts: Math.max(0, MAX_FREE_FAILURES - failures),
  };
}

/**
 * Clears failed attempts counter upon successful login.
 */
export async function clearFailedLoginAttempts(
  email: string,
  ipAddress: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `${normalizedEmail}:${ipAddress}`;
  inMemoryAttempts.delete(key);
}

/**
 * IP-level rate limiter for sign-up and password reset requests.
 * Limit: 10 requests per IP per 15-minute window.
 */
export function checkIpRateLimit(
  ipAddress: string,
  action: 'signup' | 'reset',
  maxRequests = 10,
  windowMs = 15 * 60 * 1000
): IpRateLimitStatus {
  const key = `${action}:${ipAddress}`;
  const now = Date.now();

  const existing = inMemoryIpLimits.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    inMemoryIpLimits.set(key, { count: 1, windowStart: now });
    return { isAllowed: true };
  }

  if (existing.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((existing.windowStart + windowMs - now) / 1000);
    return { isAllowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { isAllowed: true };
}
