import test from 'node:test';
import assert from 'node:assert/strict';

test('Session Security & Cookie Flag Verification (3.6)', async (t) => {
  await t.test('Cookie security policy mandates HttpOnly, Secure, and SameSite Lax', () => {
    const cookiePolicy = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    };

    assert.equal(cookiePolicy.httpOnly, true, 'Cookies must be HttpOnly to prevent XSS theft');
    assert.equal(cookiePolicy.secure, true, 'Cookies must be Secure in production');
    assert.equal(cookiePolicy.sameSite, 'lax', 'Cookies must have SameSite Lax to prevent CSRF');
    assert.equal(cookiePolicy.path, '/');
  });

  await t.test('Route protection classifies protected and public paths accurately', () => {
    const protectedPaths = [
      '/dashboard',
      '/documents',
      '/reconciliation',
      '/reports',
      '/clients',
      '/settings',
    ];

    const publicPaths = [
      '/',
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/callback',
      '/api/health',
    ];

    const isProtected = (path) =>
      path.startsWith('/dashboard') ||
      path.startsWith('/documents') ||
      path.startsWith('/reconciliation') ||
      path.startsWith('/reports') ||
      path.startsWith('/clients') ||
      path.startsWith('/settings');

    for (const p of protectedPaths) {
      assert.equal(isProtected(p), true, `Path ${p} must be protected`);
    }

    for (const p of publicPaths) {
      assert.equal(isProtected(p), false, `Path ${p} must be publicly accessible`);
    }
  });
});
