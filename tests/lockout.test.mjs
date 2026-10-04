import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  checkIpRateLimit,
} from '../src/lib/auth/lockout.ts';

test('Brute-Force Progressive Lockout & IP Rate Limiting Tests (3.5)', async (t) => {
  const testEmail = 'victim@example.com';
  const testIp = '203.0.113.42';

  // Ensure clean initial state
  await clearFailedLoginAttempts(testEmail, testIp);

  await t.test('Attempts 1 & 2: Not locked, no bot challenge required', async () => {
    const s1 = await recordFailedLoginAttempt(testEmail, testIp);
    assert.equal(s1.isLocked, false);
    assert.equal(s1.consecutiveFailures, 1);
    assert.equal(s1.requiresChallenge, false);

    const s2 = await recordFailedLoginAttempt(testEmail, testIp);
    assert.equal(s2.isLocked, false);
    assert.equal(s2.consecutiveFailures, 2);
    assert.equal(s2.requiresChallenge, false);
  });

  await t.test('Attempt 3: Triggers bot challenge requirement', async () => {
    const s3 = await recordFailedLoginAttempt(testEmail, testIp);
    assert.equal(s3.isLocked, false);
    assert.equal(s3.consecutiveFailures, 3);
    assert.equal(s3.requiresChallenge, true, '3 failures must activate bot challenge');
  });

  await t.test('Attempt 5: Triggers 1-minute progressive lockout', async () => {
    await recordFailedLoginAttempt(testEmail, testIp); // attempt 4
    const s5 = await recordFailedLoginAttempt(testEmail, testIp); // attempt 5
    assert.equal(s5.isLocked, true);
    assert.equal(s5.consecutiveFailures, 5);
    assert.equal(s5.lockDurationMinutes, 1);
  });

  await t.test('Attempt 6: Escalates to 5-minute progressive lockout', async () => {
    const s6 = await recordFailedLoginAttempt(testEmail, testIp);
    assert.equal(s6.isLocked, true);
    assert.equal(s6.consecutiveFailures, 6);
    assert.equal(s6.lockDurationMinutes, 5);
  });

  await t.test('Attempt 7: Escalates to 15-minute progressive lockout', async () => {
    const s7 = await recordFailedLoginAttempt(testEmail, testIp);
    assert.equal(s7.isLocked, true);
    assert.equal(s7.consecutiveFailures, 7);
    assert.equal(s7.lockDurationMinutes, 15);
  });

  await t.test('Successful login clears failed attempts counter', async () => {
    await clearFailedLoginAttempts(testEmail, testIp);
    const status = await checkLoginRateLimit(testEmail, testIp);
    assert.equal(status.isLocked, false);
    assert.equal(status.consecutiveFailures, 0);
    assert.equal(status.remainingAttempts, 5);
  });

  await t.test('IP rate limit: Blocks more than 10 sign-up or reset requests per IP', () => {
    const signupIp = '198.51.100.1';
    for (let i = 1; i <= 10; i++) {
      const res = checkIpRateLimit(signupIp, 'signup', 10);
      assert.equal(res.isAllowed, true);
    }
    const blockedRes = checkIpRateLimit(signupIp, 'signup', 10);
    assert.equal(blockedRes.isAllowed, false);
    assert.ok(blockedRes.retryAfterSeconds && blockedRes.retryAfterSeconds > 0);
  });
});
