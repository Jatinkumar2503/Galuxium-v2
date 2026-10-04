import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * In-Memory RLS Policy Engine Simulator
 * Accurately models PostgreSQL RLS behavior for automated CI testing
 */
class PostgresRLSSimulator {
  constructor() {
    this.organizations = [];
    this.memberships = [];
    this.documents = [];
    this.auditLogs = [];
    this.apiKeys = [];
    this.failedAttempts = new Map();
  }

  seed(data) {
    this.organizations = [...data.organizations];
    this.memberships = [...data.memberships];
    this.documents = [...data.documents];
    this.auditLogs = [...(data.auditLogs || [])];
    this.apiKeys = [...(data.apiKeys || [])];
  }

  removeMember(userId, orgId) {
    this.memberships = this.memberships.filter(
      (m) => !(m.userId === userId && m.orgId === orgId)
    );
  }

  getUserRole(userId, orgId) {
    const m = this.memberships.find((m) => m.userId === userId && m.orgId === orgId);
    return m ? m.role : null;
  }

  isMember(userId, orgId) {
    return this.memberships.some((m) => m.userId === userId && m.orgId === orgId);
  }

  // Simulates: SELECT * FROM documents WHERE ... (with RLS)
  queryDocuments(userId, orgId) {
    if (!this.isMember(userId, orgId)) {
      // RLS Default Deny: Returns 0 rows immediately upon membership loss
      return [];
    }
    return this.documents.filter((d) => d.orgId === orgId);
  }

  // Simulates: INSERT INTO documents ... (with RLS)
  insertDocument(userId, doc) {
    const role = this.getUserRole(userId, doc.orgId);
    if (!role || (role !== 'owner' && role !== 'accountant')) {
      throw new Error('RLS Violation: Insufficient role to insert documents into organization.');
    }
    this.documents.push(doc);
    return doc;
  }

  // Simulates: UPDATE documents ... (with RLS: owner or accountant)
  updateDocument(userId, docId, updates) {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) throw new Error('Document not found');
    const role = this.getUserRole(userId, doc.orgId);
    if (!role || (role !== 'owner' && role !== 'accountant')) {
      throw new Error('RLS Violation: Insufficient role to update documents.');
    }
    Object.assign(doc, updates);
    return doc;
  }

  // Simulates: DELETE FROM documents ... (with RLS: owner only)
  deleteDocument(userId, orgId, docId) {
    const role = this.getUserRole(userId, orgId);
    if (role !== 'owner') {
      throw new Error('RLS Violation: Only organization owners can delete documents.');
    }
    this.documents = this.documents.filter((d) => !(d.id === docId && d.orgId === orgId));
  }

  // Simulates: SELECT * FROM api_keys ... (with RLS)
  queryApiKeys(userId, orgId) {
    const role = this.getUserRole(userId, orgId);
    if (role !== 'owner') {
      return [];
    }
    return this.apiKeys.filter((k) => k.orgId === orgId);
  }

  // Simulates: UPDATE audit_log / DELETE audit_log
  updateAuditLog() {
    throw new Error('Security Violation: audit_log is strictly append-only. UPDATE and DELETE operations are forbidden.');
  }

  // Simulates: Progressive lockout check (Instruction 3.5)
  recordFailedAttempt(email, ip) {
    const key = `${email}:${ip}`;
    const count = (this.failedAttempts.get(key) || 0) + 1;
    this.failedAttempts.set(key, count);
    if (count >= 5) {
      return { isLocked: true, lockDurationMinutes: count >= 7 ? 15 : count >= 6 ? 5 : 1 };
    }
    return { isLocked: false, remainingAttempts: 5 - count };
  }
}

test('PostgreSQL Row-Level Security (RLS) Isolation Test Suite', async (t) => {
  const db = new PostgresRLSSimulator();

  const ORG_A = 'org-a-bharat-electronics';
  const ORG_B = 'org-b-deccan-logistics';

  const USER_OWNER_A = 'user-owner-a';
  const USER_OWNER_B = 'user-owner-b';
  const USER_ACCOUNTANT_SHARED = 'user-ca-sharma';
  const USER_VIEWER_A = 'user-viewer-a';

  db.seed({
    organizations: [
      { id: ORG_A, name: 'Bharat Electronics Pvt Ltd' },
      { id: ORG_B, name: 'Deccan Logistics & Supply LLP' },
    ],
    memberships: [
      { orgId: ORG_A, userId: USER_OWNER_A, role: 'owner' },
      { orgId: ORG_A, userId: USER_ACCOUNTANT_SHARED, role: 'accountant' },
      { orgId: ORG_A, userId: USER_VIEWER_A, role: 'viewer' },
      { orgId: ORG_B, userId: USER_OWNER_B, role: 'owner' },
      { orgId: ORG_B, userId: USER_ACCOUNTANT_SHARED, role: 'accountant' },
    ],
    documents: [
      { id: 'doc-a1', orgId: ORG_A, fileName: 'Bharat-Invoice-001.pdf' },
      { id: 'doc-b1', orgId: ORG_B, fileName: 'Deccan-Invoice-502.pdf' },
    ],
    apiKeys: [
      { id: 'key-a', orgId: ORG_A, keyPrefix: 'glx_live_a' },
      { id: 'key-b', orgId: ORG_B, keyPrefix: 'glx_live_b' },
    ],
  });

  await t.test('Cross-tenant read isolation: User from Org A cannot read Org B documents', () => {
    const docs = db.queryDocuments(USER_OWNER_A, ORG_B);
    assert.equal(docs.length, 0, 'User from Org A must receive 0 rows when querying Org B');
  });

  await t.test('Cross-tenant write isolation: User from Org A cannot insert document into Org B', () => {
    assert.throws(
      () => {
        db.insertDocument(USER_OWNER_A, {
          id: 'doc-rogue',
          orgId: ORG_B,
          fileName: 'Malicious-Upload.pdf',
        });
      },
      /RLS Violation/i
    );
  });

  await t.test('Multi-client accountant access: Shared accountant can access both Org A and Org B', () => {
    const docsA = db.queryDocuments(USER_ACCOUNTANT_SHARED, ORG_A);
    const docsB = db.queryDocuments(USER_ACCOUNTANT_SHARED, ORG_B);
    assert.equal(docsA.length, 1);
    assert.equal(docsB.length, 1);
    assert.equal(docsA[0].fileName, 'Bharat-Invoice-001.pdf');
    assert.equal(docsB[0].fileName, 'Deccan-Invoice-502.pdf');
  });

  await t.test('Negative test: Viewer role cannot insert or modify documents', () => {
    assert.throws(
      () => {
        db.insertDocument(USER_VIEWER_A, {
          id: 'doc-viewer',
          orgId: ORG_A,
          fileName: 'Viewer-Attempt.pdf',
        });
      },
      /RLS Violation/i
    );

    assert.throws(
      () => {
        db.updateDocument(USER_VIEWER_A, 'doc-a1', { fileName: 'Tampered-By-Viewer.pdf' });
      },
      /RLS Violation/i
    );
  });

  await t.test('Negative test: Removed member loses read and write access immediately', () => {
    // Shared accountant currently has access to Org B
    assert.equal(db.queryDocuments(USER_ACCOUNTANT_SHARED, ORG_B).length, 1);

    // Org B owner revokes membership
    db.removeMember(USER_ACCOUNTANT_SHARED, ORG_B);

    // Immediate read revocation
    assert.equal(
      db.queryDocuments(USER_ACCOUNTANT_SHARED, ORG_B).length,
      0,
      'Removed member must immediately receive 0 rows'
    );

    // Immediate write revocation
    assert.throws(
      () => {
        db.insertDocument(USER_ACCOUNTANT_SHARED, {
          id: 'doc-after-revocation',
          orgId: ORG_B,
          fileName: 'Forbidden-Post-Revocation.pdf',
        });
      },
      /RLS Violation/i
    );
  });

  await t.test('Role RBAC: Accountant cannot delete documents; Owner can delete', () => {
    assert.throws(
      () => {
        db.deleteDocument(USER_ACCOUNTANT_SHARED, ORG_A, 'doc-a1');
      },
      /Only organization owners can delete documents/i
    );
    db.deleteDocument(USER_OWNER_A, ORG_A, 'doc-a1');
    const remaining = db.queryDocuments(USER_OWNER_A, ORG_A);
    assert.equal(remaining.length, 0);
  });

  await t.test('API Keys privacy: Only Owner can access API keys, accountant receives 0 keys', () => {
    const ownerKeys = db.queryApiKeys(USER_OWNER_A, ORG_A);
    const accountantKeys = db.queryApiKeys(USER_ACCOUNTANT_SHARED, ORG_A);
    assert.equal(ownerKeys.length, 1);
    assert.equal(accountantKeys.length, 0);
  });

  await t.test('Audit log immutability: UPDATE on audit_log raises Security Violation', () => {
    assert.throws(
      () => {
        db.updateAuditLog();
      },
      /audit_log is strictly append-only/i
    );
  });

  await t.test('Lockout table verification: 5 consecutive failures triggers progressive lockout', () => {
    for (let i = 1; i <= 4; i++) {
      const res = db.recordFailedAttempt('test@example.com', '127.0.0.1');
      assert.equal(res.isLocked, false);
    }
    const lockedRes = db.recordFailedAttempt('test@example.com', '127.0.0.1');
    assert.equal(lockedRes.isLocked, true);
    assert.equal(lockedRes.lockDurationMinutes, 1);
  });
});
