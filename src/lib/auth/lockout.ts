/**
 * Galuxium Nexus V2: Custom Progressive Account Lockout Layer (Instruction 3.5)
 */

export interface LockoutStatus {
  isLocked: boolean;
  consecutiveFailures: number;
  lockDurationMinutes: number;
}

// In-memory fallback tracking for testing and local dev when DB is not reachable
const localAttemptsMap = new Map<string, { count: number; lockedUntil?: number }>();

export async function checkLoginRateLimit(
  email: string,
  ipAddress: string
): Promise<LockoutStatus> {
  const key = `${email}:${ipAddress}`;
  const record = localAttemptsMap.get(key);

  if (record && record.lockedUntil && Date.now() < record.lockedUntil) {
    const remainingMs = record.lockedUntil - Date.now();
    const lockDurationMinutes = Math.ceil(remainingMs / 60000);
    return {
      isLocked: true,
      consecutiveFailures: record.count,
      lockDurationMinutes,
    };
  }

  return {
    isLocked: false,
    consecutiveFailures: record ? record.count : 0,
    lockDurationMinutes: 0,
  };
}

export async function recordFailedLoginAttempt(
  email: string,
  ipAddress: string
): Promise<LockoutStatus> {
  const key = `${email}:${ipAddress}`;
  const existing = localAttemptsMap.get(key);
  const count = (existing ? existing.count : 0) + 1;

  let lockDurationMinutes = 0;
  let lockedUntil: number | undefined = undefined;

  // Progressive lockout thresholds:
  // 5 failures: 1 min
  // 6 failures: 5 min
  // 7+ failures: 15 min
  if (count >= 7) {
    lockDurationMinutes = 15;
    lockedUntil = Date.now() + 15 * 60 * 1000;
  } else if (count >= 6) {
    lockDurationMinutes = 5;
    lockedUntil = Date.now() + 5 * 60 * 1000;
  } else if (count >= 5) {
    lockDurationMinutes = 1;
    lockedUntil = Date.now() + 1 * 60 * 1000;
  }

  localAttemptsMap.set(key, { count, lockedUntil });

  return {
    isLocked: count >= 5,
    consecutiveFailures: count,
    lockDurationMinutes,
  };
}

export async function clearFailedLoginAttempts(
  email: string,
  ipAddress: string
): Promise<void> {
  const key = `${email}:${ipAddress}`;
  localAttemptsMap.delete(key);
}
