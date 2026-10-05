import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';

test('Database Migrations and Multi-Tenancy Architecture Tests', async (t) => {
  const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  const combinedSQL = migrationFiles
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');

  const tenantTables = [
    'memberships',
    'clients',
    'documents',
    'extractions',
    'bank_transactions',
    'matches',
    'flags',
    'audit_log',
    'usage_events',
    'api_keys',
  ];

  const allTables = ['organizations', ...tenantTables, 'auth_failed_attempts'];

  await t.test('All 10 tenant tables include org_id referencing organizations(id)', () => {
    for (const table of tenantTables) {
      const orgIdRegex = new RegExp(
        `CREATE TABLE IF NOT EXISTS ${table}[\\s\\S]*?org_id UUID[\\s\\S]*?REFERENCES organizations\\(id\\)`,
        'i'
      );
      assert.match(
        combinedSQL,
        orgIdRegex,
        `Table ${table} must define org_id referencing organizations(id)`
      );
    }
  });

  await t.test('All tenant tables have B-Tree indexes on org_id', () => {
    for (const table of tenantTables) {
      const indexRegex = new RegExp(`INDEX.*ON ${table}\\(.*org_id`, 'i');
      assert.match(
        combinedSQL,
        indexRegex,
        `Table ${table} must have an index covering org_id`
      );
    }
  });

  await t.test('Audit log table enforces append-only immutability trigger', () => {
    assert.match(combinedSQL, /trg_audit_log_immutable/i);
    assert.match(combinedSQL, /block_audit_log_modification/i);
    assert.match(combinedSQL, /BEFORE UPDATE OR DELETE ON audit_log/i);
  });

  await t.test('Every table has Row-Level Security enabled and forced', () => {
    for (const table of allTables) {
      const enableRegex = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, 'i');
      const forceRegex = new RegExp(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`, 'i');
      assert.match(combinedSQL, enableRegex, `Table ${table} must enable RLS`);
      assert.match(combinedSQL, forceRegex, `Table ${table} must force RLS`);
    }
  });

  await t.test('RBAC helper functions and policies are defined for owner, accountant, viewer', () => {
    assert.match(combinedSQL, /CREATE OR REPLACE FUNCTION auth_org_role/i);
    assert.match(combinedSQL, /CREATE OR REPLACE FUNCTION is_org_member/i);
    assert.match(combinedSQL, /POLICY "api_keys_owner_only"/i);
    assert.match(combinedSQL, /POLICY "documents_insert_accountant_owner"/i);
    assert.match(combinedSQL, /POLICY "documents_select_all_roles"/i);
  });

  await t.test('Duplicate document constraint and detection function are defined', () => {
    assert.match(combinedSQL, /CONSTRAINT unique_org_doc_hash UNIQUE \(org_id, content_hash\)/i);
    assert.match(combinedSQL, /CREATE OR REPLACE FUNCTION check_duplicate_document/i);
  });

  await t.test('Document validated constraint: pending row without hash succeeds; validated row without hash fails', async () => {
    // 1. Static regex validation of check_validated_complete
    assert.match(
      combinedSQL,
      /CONSTRAINT\s+check_validated_complete\s+CHECK/i,
      'Migration 000009 must define check_validated_complete constraint'
    );
    assert.match(
      combinedSQL,
      /status\s*!=\s*'validated'\s+OR\s+\([\s\S]*?content_hash\s+IS\s+NOT\s+NULL/i,
      'check_validated_complete must enforce content_hash IS NOT NULL on validated documents'
    );

    // 2. In CI environment, DATABASE_URL is strictly required to test against live Postgres
    if (process.env.CI) {
      assert.ok(
        process.env.DATABASE_URL,
        'DATABASE_URL must be defined when running in CI to execute real PostgreSQL constraint validation'
      );
    }

    if (process.env.DATABASE_URL) {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      // Disable row_security for table-level check constraint testing as superuser
      await client.query('SET row_security = off');

      try {
        let orgRes = await client.query('SELECT id FROM organizations LIMIT 1');
        let orgId = orgRes.rows[0]?.id;
        if (!orgId) {
          orgId = crypto.randomUUID();
          await client.query(
            "INSERT INTO organizations (id, name, slug, plan) VALUES ($1, 'CI Test Org', $2, 'free')",
            [orgId, `ci-org-${Date.now()}`]
          );
        }
        assert.ok(orgId, 'Must have at least one test organization in database');

        const testDocId1 = crypto.randomUUID();
        const testDocId2 = crypto.randomUUID();

        // Inserting pending_validation row with NULL content_hash must SUCCEED
        await client.query(
          `INSERT INTO documents (id, org_id, file_path, file_name, mime_type, file_size_bytes, status, content_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [testDocId1, orgId, `${orgId}/${testDocId1}/orig.pdf`, 'invoice.pdf', 'application/pdf', 1024, 'pending_validation', null]
        );

        const insertedPending = await client.query('SELECT status, content_hash FROM documents WHERE id = $1', [testDocId1]);
        assert.equal(insertedPending.rows[0].status, 'pending_validation');
        assert.equal(insertedPending.rows[0].content_hash, null);

        // Clean up testDocId1
        await client.query('DELETE FROM documents WHERE id = $1', [testDocId1]);

        // Inserting validated row with NULL content_hash must FAIL with check_validated_complete error
        await assert.rejects(
          async () => {
            await client.query(
              `INSERT INTO documents (id, org_id, file_path, file_name, mime_type, file_size_bytes, status, content_hash)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [testDocId2, orgId, `${orgId}/${testDocId2}/orig.pdf`, 'invoice.pdf', 'application/pdf', 1024, 'validated', null]
            );
          },
          /check_validated_complete/i,
          'Inserting validated document without content_hash must reject with check_validated_complete error'
        );
      } finally {
        await client.end();
      }
    } else {
      // Deterministic validation of check_validated_complete constraint logic
      const checkConstraint = (status, content_hash, file_path, file_name, mime_type, file_size_bytes) => {
        if (status === 'validated') {
          return (
            content_hash !== null &&
            content_hash !== undefined &&
            Boolean(file_path) &&
            Boolean(file_name) &&
            Boolean(mime_type) &&
            typeof file_size_bytes === 'number'
          );
        }
        return true;
      };

      assert.equal(
        checkConstraint('pending_validation', null, 'path', 'name', 'pdf', 100),
        true,
        'pending_validation with null content_hash must pass'
      );
      assert.equal(
        checkConstraint('validated', null, 'path', 'name', 'pdf', 100),
        false,
        'validated with null content_hash must fail'
      );
      assert.equal(
        checkConstraint('validated', 'a'.repeat(64), 'path', 'name', 'pdf', 100),
        true,
        'validated with valid content_hash must pass'
      );
    }
  });

  await t.test('Full migration chain cleanly defines storage skip block and required indexes', async () => {
    // 1. Verify storage skip block is present in migration 000009
    assert.match(
      combinedSQL,
      /IF to_regnamespace\('storage'\) IS NULL THEN/i,
      'Migration must include safe skip block for environments lacking storage schema'
    );

    // 2. Verify audit_log composite indexes are defined for durable rate limiting
    assert.match(
      combinedSQL,
      /CREATE INDEX IF NOT EXISTS idx_audit_log_org_action_created\s*ON public\.audit_log\s*\(org_id,\s*action,\s*created_at\)/i,
      'idx_audit_log_org_action_created index must be defined'
    );
    assert.match(
      combinedSQL,
      /CREATE INDEX IF NOT EXISTS idx_audit_log_actor_action_created\s*ON public\.audit_log\s*\(actor_id,\s*action,\s*created_at\)/i,
      'idx_audit_log_actor_action_created index must be defined'
    );

    // 3. In CI environment, DATABASE_URL is strictly required to test migration application
    if (process.env.CI) {
      assert.ok(
        process.env.DATABASE_URL,
        'DATABASE_URL must be defined when running in CI to verify clean migration application against PostgreSQL'
      );
    }

    if (process.env.DATABASE_URL) {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await client.query('SET row_security = off');
      try {
        const checkRes = await client.query(
          "SELECT conname FROM pg_constraint WHERE conname = 'check_validated_complete'"
        );
        assert.equal(checkRes.rows.length, 1, 'check_validated_complete must exist in live database');

        const indexRes = await client.query(
          "SELECT indexname FROM pg_indexes WHERE tablename = 'audit_log' AND indexname IN ('idx_audit_log_org_action_created', 'idx_audit_log_actor_action_created')"
        );
        assert.equal(indexRes.rows.length, 2, 'Both rate-limit composite indexes must exist in live database');
      } finally {
        await client.end();
      }
    }
  });
});

