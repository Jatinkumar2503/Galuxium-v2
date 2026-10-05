import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword } from '../src/lib/auth/password-policy.ts';

test('Password Policy & Breached List Verification', async (t) => {
  await t.test('Rejects passwords under 12 characters', () => {
    const resShort = validatePassword('ShortPass1!'); // 11 chars
    assert.equal(resShort.isValid, false);
    assert.match(resShort.error, /at least 12 characters/i);
  });

  await t.test('Accepts strong multi-word passphrases without composition gimmicks', () => {
    // NIST SP 800-63B compliant: 4 random words, no symbols required
    const resValid = validatePassword('correct horse battery staple');
    assert.equal(resValid.isValid, true);
    assert.equal(resValid.error, undefined);
  });

  await t.test('Rejects known breached passwords even if length >= 12', () => {
    const resBreached = validatePassword('password123456');
    assert.equal(resBreached.isValid, false);
    assert.match(resBreached.error, /appeared in data breaches/i);

    const resBreached2 = validatePassword('qwertyuiop123');
    assert.equal(resBreached2.isValid, false);
  });

  await t.test('Rejects predictable sequential patterns', () => {
    const resSeq = validatePassword('123456789012');
    assert.equal(resSeq.isValid, false);
  });
});
