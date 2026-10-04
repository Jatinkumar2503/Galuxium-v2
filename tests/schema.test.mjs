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
});
