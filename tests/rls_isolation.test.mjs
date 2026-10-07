import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * In-Memory RLS Policy Engine Simulator
 * Fallback for offline local runs when DATABASE_URL is not present
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

  queryDocuments(userId, orgId) {
    if (!this.isMember(userId, orgId)) {
      return [];
    }
    return this.documents.filter((d) => d.orgId === orgId);
  }

  insertDocument(userId, doc) {
    const role = this.getUserRole(userId, doc.orgId);
    if (!role || (role !== 'owner' && role !== 'accountant')) {
      const err = new Error('new row violates row-level security policy for table "documents"');
      err.code = '42501';
      throw err;
    }
    this.documents.push(doc);
    return doc;
  }

  updateDocument(userId, docId, updates) {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) throw new Error('Document not found');
    const role = this.getUserRole(userId, doc.orgId);
    if (!role || (role !== 'owner' && role !== 'accountant')) {
      const err = new Error('new row violates row-level security policy for table "documents"');
      err.code = '42501';
      throw err;
    }
    Object.assign(doc, updates);
    return doc;
  }

  deleteDocument(userId, orgId, docId) {
    const role = this.getUserRole(userId, orgId);
    if (role !== 'owner') {
      const err = new Error('Only organization owners can delete documents.');
      err.code = '42501';
      throw err;
    }
    this.documents = this.documents.filter((d) => !(d.id === docId && d.orgId === orgId));
  }

  queryApiKeys(userId, orgId) {
    const role = this.getUserRole(userId, orgId);
    if (role !== 'owner') {
      return [];
    }
    return this.apiKeys.filter((k) => k.orgId === orgId);
  }

  updateAuditLog() {
    throw new Error('Security Violation: audit_log is strictly append-only. UPDATE and DELETE operations are forbidden.');
  }

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
  // Deterministic UUIDs matching seed.sql & ci/auth_stub.sql
  const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const USER_OWNER_A = '11111111-1111-1111-1111-111111111111';
  const USER_OWNER_B = '22222222-2222-2222-2222-222222222222';
  const USER_ACCOUNTANT_SHARED = '33333333-3333-3333-3333-333333333333';
  const USER_VIEWER_A = '44444444-4444-4444-4444-444444444444';

  if (process.env.CI) {
    assert.ok(
      process.env.DATABASE_URL,
      'DATABASE_URL must be set in CI so RLS isolation tests execute against real PostgreSQL'
    );
  }

  if (process.env.DATABASE_URL) {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    /**
     * Executes queries within a transactional context simulating a Supabase PostgREST session:
     * - Role set to 'authenticated'
     * - JWT claims set with caller's user UUID ('sub')
     */
    async function withUserSession(userId, callback) {
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL ROLE authenticated');
        await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ sub: userId, role: 'authenticated' }),
        ]);
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
        await client.query(`SELECT set_config('request.jwt.claim.role', $1, true)`, ['authenticated']);
        const res = await callback();
        await client.query('COMMIT');
        return res;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    try {
      await t.test('Cross-tenant read isolation: User from Org A cannot read Org B documents', async () => {
        const res = await withUserSession(USER_OWNER_A, async () => {
          return client.query('SELECT * FROM documents WHERE org_id = $1', [ORG_B]);
        });
        assert.equal(res.rows.length, 0, 'User from Org A must receive exactly 0 rows when querying Org B documents');
      });

      await t.test('Cross-tenant write isolation: User from Org A cannot insert document into Org B', async () => {
        await assert.rejects(
          async () => {
            await withUserSession(USER_OWNER_A, async () => {
              const rogueDocId = crypto.randomUUID();
              await client.query(
                `INSERT INTO documents (id, org_id, file_path, file_name, mime_type, file_size_bytes, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pending_validation')`,
                [rogueDocId, ORG_B, `${ORG_B}/${rogueDocId}/orig.pdf`, 'Malicious.pdf', 'application/pdf', 2048]
              );
            });
          },
          (err) => {
            assert.equal(err.code, '42501', `Expected SQLSTATE 42501, got ${err.code}`);
            assert.match(err.message, /row-level security/i, `Expected RLS violation message, got: ${err.message}`);
            return true;
          },
          'User from Org A inserting into Org B must fail with SQLSTATE 42501 and row-level security violation'
        );
      });

      await t.test('Multi-client accountant access: Shared accountant can access both Org A and Org B', async () => {
        const docsA = await withUserSession(USER_ACCOUNTANT_SHARED, async () => {
          return client.query('SELECT * FROM documents WHERE org_id = $1', [ORG_A]);
        });
        const docsB = await withUserSession(USER_ACCOUNTANT_SHARED, async () => {
          return client.query('SELECT * FROM documents WHERE org_id = $1', [ORG_B]);
        });
        assert.ok(docsA.rows.length >= 1, 'Accountant must see Org A documents');
        assert.ok(docsB.rows.length >= 1, 'Accountant must see Org B documents');
      });

      await t.test('Negative test: Viewer role cannot insert or modify documents', async () => {
        // Viewer INSERT attempt
        await assert.rejects(
          async () => {
            await withUserSession(USER_VIEWER_A, async () => {
              const viewerDocId = crypto.randomUUID();
              await client.query(
                `INSERT INTO documents (id, org_id, file_path, file_name, mime_type, file_size_bytes, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pending_validation')`,
                [viewerDocId, ORG_A, `${ORG_A}/${viewerDocId}/orig.pdf`, 'Viewer.pdf', 'application/pdf', 1024]
              );
            });
          },
          (err) => {
            assert.equal(err.code, '42501', `Expected SQLSTATE 42501, got ${err.code}`);
            assert.match(err.message, /row-level security/i, `Expected RLS violation message, got: ${err.message}`);
            return true;
          },
          'Viewer INSERT must fail with SQLSTATE 42501 and row-level security violation'
        );

        // Viewer UPDATE attempt
        const updateRes = await withUserSession(USER_VIEWER_A, async () => {
          return client.query(
            "UPDATE documents SET file_name = 'Tampered.pdf' WHERE org_id = $1",
            [ORG_A]
          );
        });
        assert.equal(updateRes.rowCount, 0, 'Viewer UPDATE must modify 0 rows under RLS');
      });

      await t.test('Negative test: Removed member loses read and write access immediately', async () => {
        // Verify accountant initially has access to Org B
        const initialB = await withUserSession(USER_ACCOUNTANT_SHARED, async () => {
          return client.query('SELECT * FROM documents WHERE org_id = $1', [ORG_B]);
        });
        assert.ok(initialB.rows.length >= 1);

        // Superuser removes accountant membership from Org B
        await client.query(
          'DELETE FROM memberships WHERE org_id = $1 AND user_id = $2',
          [ORG_B, USER_ACCOUNTANT_SHARED]
        );

        try {
          // Immediately after removal, accountant gets 0 rows
          const postRemoval = await withUserSession(USER_ACCOUNTANT_SHARED, async () => {
            return client.query('SELECT * FROM documents WHERE org_id = $1', [ORG_B]);
          });
          assert.equal(postRemoval.rows.length, 0, 'Removed member must immediately receive 0 rows');

          // Immediately after removal, accountant write fails with 42501
          await assert.rejects(
            async () => {
              await withUserSession(USER_ACCOUNTANT_SHARED, async () => {
                const docId = crypto.randomUUID();
                await client.query(
                  `INSERT INTO documents (id, org_id, file_path, file_name, mime_type, file_size_bytes, status)
                   VALUES ($1, $2, $3, $4, $5, $6, 'pending_validation')`,
                  [docId, ORG_B, `${ORG_B}/${docId}/orig.pdf`, 'Revoked.pdf', 'application/pdf', 1024]
                );
              });
            },
            (err) => {
              assert.equal(err.code, '42501', `Expected SQLSTATE 42501, got ${err.code}`);
              assert.match(err.message, /row-level security/i, `Expected RLS violation message, got: ${err.message}`);
              return true;
            }
          );
        } finally {
          // Restore accountant membership for subsequent tests
          await client.query(
            'INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING',
            [ORG_B, USER_ACCOUNTANT_SHARED, 'accountant']
          );
        }
      });

      await t.test('Role RBAC: Accountant cannot delete documents; Owner can delete', async () => {
        // Create a test document in Org A for deletion test
        const testDocId = crypto.randomUUID();
        await client.query(
          `INSERT INTO documents (id, org_id, file_path, file_name, mime_type, file_size_bytes, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending_validation')`,
          [testDocId, ORG_A, `${ORG_A}/${testDocId}/orig.pdf`, 'DeleteTest.pdf', 'application/pdf', 1024]
        );

        // Accountant attempts DELETE: deletes 0 rows under RLS
        const deleteByAccountant = await withUserSession(USER_ACCOUNTANT_SHARED, async () => {
          return client.query('DELETE FROM documents WHERE id = $1', [testDocId]);
        });
        assert.equal(deleteByAccountant.rowCount, 0, 'Accountant DELETE must affect 0 rows');

        // Owner attempts DELETE: successfully deletes 1 row
        const deleteByOwner = await withUserSession(USER_OWNER_A, async () => {
          return client.query('DELETE FROM documents WHERE id = $1', [testDocId]);
        });
        assert.equal(deleteByOwner.rowCount, 1, 'Owner DELETE must affect 1 row');
      });

      await t.test('API Keys privacy: Only Owner can access API keys, accountant receives 0 keys', async () => {
        const testKeyHash = crypto.createHash('sha256').update(`key-${Date.now()}`).digest('hex');
        
        // Owner inserts API key
        await withUserSession(USER_OWNER_A, async () => {
          await client.query(
            `INSERT INTO api_keys (org_id, name, key_hash, key_prefix) VALUES ($1, $2, $3, $4)`,
            [ORG_A, 'Owner Test Key', testKeyHash, 'glx_test_a']
          );
        });

        // Owner queries API keys: sees the key
        const ownerKeys = await withUserSession(USER_OWNER_A, async () => {
          return client.query('SELECT * FROM api_keys WHERE org_id = $1', [ORG_A]);
        });
        assert.ok(ownerKeys.rows.length >= 1, 'Owner must be able to read API keys');

        // Accountant queries API keys: receives 0 rows
        const accountantKeys = await withUserSession(USER_ACCOUNTANT_SHARED, async () => {
          return client.query('SELECT * FROM api_keys WHERE org_id = $1', [ORG_A]);
        });
        assert.equal(accountantKeys.rows.length, 0, 'Accountant must receive 0 API keys under RLS');

        // Clean up test key
        await client.query('DELETE FROM api_keys WHERE key_hash = $1', [testKeyHash]);
      });

      await t.test('Audit log immutability: UPDATE on audit_log raises Security Violation', async () => {
        // Insert test entry
        const entryRes = await client.query(
          `INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, 'test_action', 'document', 'test-entity', '{}') RETURNING id`,
          [ORG_A, USER_OWNER_A]
        );
        const entryId = entryRes.rows[0].id;

        // Attempt UPDATE (blocked by immutable trigger for all roles including superuser)
        await assert.rejects(
          async () => {
            await client.query('UPDATE audit_log SET action = $1 WHERE id = $2', ['tampered', entryId]);
          },
          /audit_log is strictly append-only/i,
          'UPDATE on audit_log must raise Security Violation trigger exception'
        );
      });

      await t.test('20 concurrent inserts cryptographic audit hash chain verification against PostgreSQL', async () => {
        // Dedicated test org for isolated hash chain test
        const testChainOrg = crypto.randomUUID();
        await client.query(
          "INSERT INTO organizations (id, name, slug, plan) VALUES ($1, 'Audit Chain Org', $2, 'free')",
          [testChainOrg, `audit-chain-${Date.now()}`]
        );

        // Open 20 separate database connections to test concurrent writers with PostgreSQL advisory lock
        const poolClients = await Promise.all(
          Array.from({ length: 20 }, async () => {
            const c = new Client({ connectionString: process.env.DATABASE_URL });
            await c.connect();
            return c;
          })
        );

        try {
          // Fire all 20 inserts simultaneously across distinct connections
          await Promise.all(
            poolClients.map((c, i) =>
              c.query(
                `INSERT INTO audit_log (org_id, actor_id, action, entity_type, entity_id, details)
                 VALUES ($1, $2, $3, 'document', $4, '{}')`,
                [testChainOrg, USER_OWNER_A, `concurrent_action_${i}`, `concurrent_entity_${i}`]
              )
            )
          );

          // Query back ordered by monotonic seq ASC
          const chainRes = await client.query(
            `SELECT id, seq, org_id, actor_id, action, entity_type, entity_id, details, prev_hash, entry_hash
             FROM audit_log
             WHERE org_id = $1
             ORDER BY seq ASC`,
            [testChainOrg]
          );

          assert.equal(chainRes.rows.length, 20, 'Must have inserted exactly 20 chain rows');

          // Verify unbroken cryptographic chain from Genesis without forks
          const genesis = '0000000000000000000000000000000000000000000000000000000000000000';
          const byPrevHash = new Map();
          for (const row of chainRes.rows) {
            assert.ok(
              !byPrevHash.has(row.prev_hash),
              `Chain fork detected under concurrency! Multiple entries point to prev_hash ${row.prev_hash}`
            );
            byPrevHash.set(row.prev_hash, row);
            assert.equal(row.entry_hash.length, 64, 'Entry hash must be 64-char SHA256 hex');
          }

          // Walk the chain from Genesis to tip (verifying exactly 20 unbroken links, sequential seq, and recomputing hashes)
          let currentPrev = genesis;
          let chainLength = 0;
          while (byPrevHash.has(currentPrev)) {
            const nextNode = byPrevHash.get(currentPrev);
            chainLength++;

            // Verify strict monotonic sequential indexing (1..20)
            assert.equal(
              Number(nextNode.seq),
              chainLength,
              `Row seq (${nextNode.seq}) must match sequential chain index (${chainLength})`
            );

            // Recompute SHA-256 entry_hash from row payload to ensure content integrity against tampering
            const detailsStr = typeof nextNode.details === 'string'
              ? nextNode.details
              : JSON.stringify(nextNode.details);
            const expectedPayload = `${nextNode.prev_hash}:${nextNode.org_id}:${nextNode.action}:${nextNode.entity_type}:${nextNode.entity_id}:${detailsStr}:${nextNode.actor_id || 'system'}`;
            const expectedHash = crypto.createHash('sha256').update(expectedPayload).digest('hex');

            assert.equal(
              nextNode.entry_hash,
              expectedHash,
              `Row seq ${nextNode.seq} entry_hash must strictly match SHA-256 digest of its payload content`
            );

            currentPrev = nextNode.entry_hash;
          }

          assert.equal(
            chainLength,
            20,
            'All 20 concurrent inserts must form an unbroken, non-forking linear chain from Genesis'
          );
        } finally {
          await Promise.all(poolClients.map((c) => c.end()));
        }
      });
    } finally {
      await client.end();
    }
  } else {
    // Offline local simulation mode
    const db = new PostgresRLSSimulator();
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
      ],
    });

    await t.test('Cross-tenant read isolation: User from Org A cannot read Org B documents', () => {
      const docs = db.queryDocuments(USER_OWNER_A, ORG_B);
      assert.equal(docs.length, 0);
    });

    await t.test('Cross-tenant write isolation: User from Org A cannot insert document into Org B', () => {
      assert.throws(() => db.insertDocument(USER_OWNER_A, { id: 'd1', orgId: ORG_B, fileName: 'm.pdf' }), /violates row-level security/i);
    });

    await t.test('Multi-client accountant access: Shared accountant can access both Org A and Org B', () => {
      assert.equal(db.queryDocuments(USER_ACCOUNTANT_SHARED, ORG_A).length, 1);
      assert.equal(db.queryDocuments(USER_ACCOUNTANT_SHARED, ORG_B).length, 1);
    });

    await t.test('Negative test: Viewer role cannot insert or modify documents', () => {
      assert.throws(() => db.insertDocument(USER_VIEWER_A, { id: 'd2', orgId: ORG_A, fileName: 'v.pdf' }), /violates row-level security/i);
    });

    await t.test('Negative test: Removed member loses read and write access immediately', () => {
      db.removeMember(USER_ACCOUNTANT_SHARED, ORG_B);
      assert.equal(db.queryDocuments(USER_ACCOUNTANT_SHARED, ORG_B).length, 0);
    });

    await t.test('Role RBAC: Accountant cannot delete documents; Owner can delete', () => {
      assert.throws(() => db.deleteDocument(USER_ACCOUNTANT_SHARED, ORG_A, 'doc-a1'), /Only organization owners/i);
      db.deleteDocument(USER_OWNER_A, ORG_A, 'doc-a1');
      assert.equal(db.queryDocuments(USER_OWNER_A, ORG_A).length, 0);
    });

    await t.test('API Keys privacy: Only Owner can access API keys, accountant receives 0 keys', () => {
      assert.equal(db.queryApiKeys(USER_OWNER_A, ORG_A).length, 1);
      assert.equal(db.queryApiKeys(USER_ACCOUNTANT_SHARED, ORG_A).length, 0);
    });

    await t.test('Audit log immutability: UPDATE on audit_log raises Security Violation', () => {
      assert.throws(() => db.updateAuditLog(), /strictly append-only/i);
    });
  }
});
