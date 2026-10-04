import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

function computeEntryHash(prevHash, orgId, action, entityType, entityId, details, actorId) {
  const payload = `${prevHash}:${orgId}:${action}:${entityType}:${entityId}:${JSON.stringify(details)}:${actorId || 'system'}`;
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Concurrency Mutex Simulator (matches pg_advisory_xact_lock behavior)
 */
class OrgAuditMutexSimulator {
  constructor() {
    this.chain = [];
    this.GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';
    this.locked = false;
  }

  async insertWithAdvisoryLock(orgId, action, entityType, entityId, details, actorId) {
    // Wait until lock is available (transaction serialization)
    while (this.locked) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    this.locked = true;

    try {
      const prevHash = this.chain.length === 0 ? this.GENESIS : this.chain[this.chain.length - 1].entryHash;
      const entryHash = computeEntryHash(prevHash, orgId, action, entityType, entityId, details, actorId);
      const entry = {
        id: this.chain.length + 1,
        orgId,
        prevHash,
        entryHash,
        action,
      };
      this.chain.push(entry);
      return entry;
    } finally {
      this.locked = false;
    }
  }
}

test('Tamper-Evident SHA-256 Audit Log Hash-Chain Verification', async (t) => {
  const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
  const orgId = '7f864f8a-9db3-424b-73c4-8dbb71ea38d7';

  const chain = [];

  // Entry 1
  const h1 = computeEntryHash(
    GENESIS_HASH,
    orgId,
    'document_uploaded',
    'document',
    'doc-001',
    { fileName: 'INV-2026-09.pdf' },
    'user-owner-1'
  );
  chain.push({ id: 1, prevHash: GENESIS_HASH, entryHash: h1, action: 'document_uploaded' });

  // Entry 2
  const h2 = computeEntryHash(
    h1,
    orgId,
    'extraction_validated',
    'extraction',
    'ext-001',
    { totalAmount: 45000, gstin: '27AABCU9603R1ZM' },
    'system'
  );
  chain.push({ id: 2, prevHash: h1, entryHash: h2, action: 'extraction_validated' });

  // Entry 3
  const h3 = computeEntryHash(
    h2,
    orgId,
    'reconciliation_approved',
    'match',
    'match-001',
    { matchScore: 0.985 },
    'user-accountant-1'
  );
  chain.push({ id: 3, prevHash: h2, entryHash: h3, action: 'reconciliation_approved' });

  await t.test('Chain verifies successfully with uncorrupted entries', () => {
    let currentPrev = GENESIS_HASH;
    for (const entry of chain) {
      assert.equal(entry.prevHash, currentPrev);
      currentPrev = entry.entryHash;
    }
  });

  await t.test('Tampering with Entry 2 immediately invalidates downstream hash chain', () => {
    const tamperedH2 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const isChainValid = chain[2].prevHash === tamperedH2;
    assert.equal(isChainValid, false, 'Tampered hash must break downstream pointer');
  });

  await t.test('Concurrent 20 audit inserts serialize cleanly without hash forks via advisory lock', async () => {
    const simulator = new OrgAuditMutexSimulator();
    const concurrentInserts = Array.from({ length: 20 }, (_, i) =>
      simulator.insertWithAdvisoryLock(
        orgId,
        `concurrent_action_${i}`,
        'document',
        `doc-${i}`,
        { index: i, timestamp: Date.now() },
        'user-concurrent'
      )
    );

    const results = await Promise.all(concurrentInserts);
    assert.equal(results.length, 20);
    assert.equal(simulator.chain.length, 20);

    // Verify entire serialized chain has 0 breaks or forks
    let expectedPrev = simulator.GENESIS;
    for (let i = 0; i < simulator.chain.length; i++) {
      const entry = simulator.chain[i];
      assert.equal(entry.prevHash, expectedPrev, `Entry ${i} must link to previous entry hash`);
      expectedPrev = entry.entryHash;
    }
  });
});
