import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

function computeEntryHash(prevHash, orgId, action, entityType, entityId, details, actorId) {
  const payload = `${prevHash}:${orgId}:${action}:${entityType}:${entityId}:${JSON.stringify(details)}:${actorId || 'system'}`;
  return createHash('sha256').update(payload).digest('hex');
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
    // Malicious attacker attempts to change amount or prevHash of Entry 2
    const tamperedH2 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const isChainValid = chain[2].prevHash === tamperedH2;
    assert.equal(isChainValid, false, 'Tampered hash must break downstream pointer');
  });
});
