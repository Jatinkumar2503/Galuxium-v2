import test from 'node:test';
import assert from 'node:assert/strict';

class ServerRbacSimulator {
  constructor(memberships) {
    this.memberships = memberships; // Map of `${userId}:${orgId}` -> role
  }

  evaluateGuard(user, orgId, allowedRoles) {
    if (!user) {
      throw new Error('UnauthorizedError: Authentication required');
    }

    const key = `${user.id}:${orgId}`;
    const role = this.memberships.get(key);

    if (!role) {
      throw new Error('ForbiddenError: You are not a member of this organization.');
    }

    if (!allowedRoles.includes(role)) {
      throw new Error(
        `ForbiddenError: Access denied. Role "${role}" lacks permission. Required: [${allowedRoles.join(', ')}]`
      );
    }

    return { userId: user.id, orgId, role };
  }
}

test('Server-Side Role Guard Tests (3.8)', async (t) => {
  const memberships = new Map([
    ['user-owner:org-1', 'owner'],
    ['user-accountant:org-1', 'accountant'],
    ['user-viewer:org-1', 'viewer'],
  ]);

  const guard = new ServerRbacSimulator(memberships);

  await t.test('1. Allows authenticated user with authorized role', () => {
    const res = guard.evaluateGuard({ id: 'user-owner' }, 'org-1', ['owner']);
    assert.equal(res.role, 'owner');
  });

  await t.test('2. Allows accountant when accountant or owner is specified', () => {
    const res = guard.evaluateGuard({ id: 'user-accountant' }, 'org-1', ['owner', 'accountant']);
    assert.equal(res.role, 'accountant');
  });

  await t.test('3. Rejects viewer when owner or accountant is required', () => {
    assert.throws(
      () => {
        guard.evaluateGuard({ id: 'user-viewer' }, 'org-1', ['owner', 'accountant']);
      },
      /ForbiddenError.*lacks permission/i
    );
  });

  await t.test('4. Rejects unauthenticated request', () => {
    assert.throws(
      () => {
        guard.evaluateGuard(null, 'org-1', ['viewer', 'accountant', 'owner']);
      },
      /UnauthorizedError/i
    );
  });

  await t.test('5. Rejects user attempting to access foreign org they are not member of', () => {
    assert.throws(
      () => {
        guard.evaluateGuard({ id: 'user-owner' }, 'org-foreign', ['owner']);
      },
      /not a member of this organization/i
    );
  });
});
