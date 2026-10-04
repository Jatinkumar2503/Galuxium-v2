import test from 'node:test';
import assert from 'node:assert/strict';

class AccountLinkingDirectory {
  constructor() {
    this.accounts = new Map(); // email -> { userId, verified, providers: Set }
  }

  registerOrLink(email, provider, isEmailVerified) {
    const normalized = email.toLowerCase().trim();

    if (!isEmailVerified) {
      throw new Error('Security Error: Unverified emails cannot link to accounts.');
    }

    if (this.accounts.has(normalized)) {
      const existing = this.accounts.get(normalized);
      existing.providers.add(provider);
      return {
        userId: existing.userId,
        email: normalized,
        isNewUser: false,
        providers: Array.from(existing.providers),
      };
    }

    const newUserId = `usr_${Math.random().toString(36).substring(2, 10)}`;
    const newRecord = {
      userId: newUserId,
      verified: true,
      providers: new Set([provider]),
    };
    this.accounts.set(normalized, newRecord);

    return {
      userId: newUserId,
      email: normalized,
      isNewUser: true,
      providers: [provider],
    };
  }
}

test('Account Linking & Identity Resolution Tests (3.7)', async (t) => {
  const directory = new AccountLinkingDirectory();
  const corporateEmail = 'ca.sharma@nexusadvisory.in';

  await t.test('1. First registration via Email + Password creates new account', () => {
    const res = directory.registerOrLink(corporateEmail, 'email', true);
    assert.equal(res.isNewUser, true);
    assert.deepEqual(res.providers, ['email']);
  });

  await t.test('2. Subsequent sign-in via Google with SAME verified email links to the SAME account', () => {
    const initialAccount = directory.accounts.get(corporateEmail);
    const initialUserId = initialAccount.userId;

    const res = directory.registerOrLink(corporateEmail, 'google', true);
    assert.equal(res.isNewUser, false, 'Must link to existing account, not create a duplicate');
    assert.equal(res.userId, initialUserId, 'User ID must remain identical across providers');
    assert.ok(res.providers.includes('email') && res.providers.includes('google'));
  });

  await t.test('3. Unverified identity cannot link or hijack existing account', () => {
    assert.throws(
      () => {
        directory.registerOrLink(corporateEmail, 'google', false);
      },
      /Unverified emails cannot link/i
    );
  });
});
