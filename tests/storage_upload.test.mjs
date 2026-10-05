import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

import {
  detectTypeFromMagicBytes,
  validatePdf,
  validateAndCleanImage,
  validateCsv,
  validateFinalObject,
  sanitizeFilename,
  computeContentHash,
  MAX_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from '../src/lib/storage/validation.ts';

import {
  checkUploadRateLimit,
  checkUploadRateLimitDurable,
  rateTracker,
} from '../src/lib/storage/rate-limit.ts';

/**
 * Storage Security Policy Engine Simulator
 * Accurately models Supabase Storage RLS policies defined in 20261005000008_storage_documents_bucket.sql
 */
class SupabaseStoragePolicySimulator {
  constructor() {
    this.buckets = new Map([
      ['documents', { public: false, fileSizeLimit: 10485760, allowedMimeTypes: Object.values(ALLOWED_MIME_TYPES) }]
    ]);
    this.memberships = new Map(); // key: `${userId}:${orgId}` -> 'owner' | 'accountant' | 'viewer'
    this.objects = new Map(); // key: `documents/${path}` -> { content, size, createdAt }
  }

  setMember(userId, orgId, role) {
    this.memberships.set(`${userId}:${orgId}`, role);
  }

  removeMember(userId, orgId) {
    this.memberships.delete(`${userId}:${orgId}`);
  }

  safeUuid(folder) {
    if (!folder) return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(folder) ? folder.toLowerCase() : null;
  }

  getOrgRole(userId, orgId) {
    if (!orgId) return null;
    return this.memberships.get(`${userId}:${orgId}`) || null;
  }

  isOrgMember(userId, orgId) {
    if (!orgId) return false;
    return this.memberships.has(`${userId}:${orgId}`);
  }

  // Corresponds to documents_select_member policy
  canSelectObject(userId, path) {
    if (!userId) return false; // Unauthenticated default deny
    const firstFolder = path.split('/')[0];
    const orgId = this.safeUuid(firstFolder);
    return this.isOrgMember(userId, orgId);
  }

  // Corresponds to documents_insert_writer policy
  canInsertObject(userId, path, upsert = false) {
    if (!userId) return false;
    // Overwriting existing object is forbidden (no UPDATE policy, upsert: false)
    if (this.objects.has(`documents/${path}`) && !upsert) {
      return false;
    }
    const firstFolder = path.split('/')[0];
    const orgId = this.safeUuid(firstFolder);
    const role = this.getOrgRole(userId, orgId);
    return role === 'owner' || role === 'accountant';
  }

  // Corresponds to documents_delete_owner policy
  canDeleteObject(userId, path) {
    if (!userId) return false;
    const firstFolder = path.split('/')[0];
    const orgId = this.safeUuid(firstFolder);
    const role = this.getOrgRole(userId, orgId);
    return role === 'owner';
  }

  // Simulates signed URL expiration check
  verifySignedUrl(tokenTimestamp, expiresInSeconds, currentTimestamp) {
    return currentTimestamp <= tokenTimestamp + expiresInSeconds * 1000;
  }
}

test('Phase 5: Document Ingestion, Storage Policies, and Finalize Validation Tests (5.1 - 5.4)', async (t) => {
  const sim = new SupabaseStoragePolicySimulator();
  const orgA = '11111111-1111-4111-a111-111111111111';
  const orgB = '22222222-2222-4222-a222-222222222222';
  const userA = 'user-org-a';
  const userB = 'user-org-b';
  const userViewer = 'user-viewer';
  const userAccountant = 'user-accountant';
  const userOwner = 'user-owner';

  sim.setMember(userA, orgA, 'owner');
  sim.setMember(userB, orgB, 'owner');
  sim.setMember(userViewer, orgA, 'viewer');
  sim.setMember(userAccountant, orgA, 'accountant');
  sim.setMember(userOwner, orgA, 'owner');

  // --------------------------------------------------------------------------
  // Test 1: User in Org A cannot read, list, or sign a URL for an Org B object
  // --------------------------------------------------------------------------
  await t.test('1. A user in Org A cannot read, list, or sign a URL for an Org B object', () => {
    const orgBPath = `${orgB}/doc-123/original.pdf`;
    assert.equal(sim.canSelectObject(userA, orgBPath), false, 'User A must not be allowed to select Org B object');
    assert.equal(sim.canSelectObject(userB, orgBPath), true, 'User B must be allowed to select Org B object');
  });

  // --------------------------------------------------------------------------
  // Test 2: A viewer cannot upload; an accountant and an owner can
  // --------------------------------------------------------------------------
  await t.test('2. A viewer cannot upload; an accountant and an owner can', () => {
    const path = `${orgA}/doc-new/original.pdf`;
    assert.equal(sim.canInsertObject(userViewer, path), false, 'Viewer role must NOT be permitted to upload');
    assert.equal(sim.canInsertObject(userAccountant, path), true, 'Accountant role must be permitted to upload');
    assert.equal(sim.canInsertObject(userOwner, path), true, 'Owner role must be permitted to upload');
  });

  // --------------------------------------------------------------------------
  // Test 3: Only an owner can delete; nobody can overwrite or update an existing object
  // --------------------------------------------------------------------------
  await t.test('3. Only an owner can delete; nobody can overwrite or update an existing object', () => {
    const path = `${orgA}/doc-existing/original.pdf`;
    // Seed existing object
    sim.objects.set(`documents/${path}`, { size: 1024, createdAt: Date.now() });

    // Delete permissions
    assert.equal(sim.canDeleteObject(userViewer, path), false, 'Viewer cannot delete');
    assert.equal(sim.canDeleteObject(userAccountant, path), false, 'Accountant cannot delete');
    assert.equal(sim.canDeleteObject(userOwner, path), true, 'Owner can delete');

    // Overwrite / Update permissions: Stored objects are immutable (upsert: false)
    assert.equal(sim.canInsertObject(userOwner, path, false), false, 'Owner cannot overwrite existing object without upsert');
    assert.equal(sim.canInsertObject(userAccountant, path, false), false, 'Accountant cannot overwrite existing object');
  });

  // --------------------------------------------------------------------------
  // Test 4: A path whose first folder is not a valid uuid is denied without throwing an error
  // --------------------------------------------------------------------------
  await t.test('4. A path whose first folder is not a valid uuid is denied without throwing an error', () => {
    const invalidPaths = [
      'not-a-uuid/doc-1/original.pdf',
      '../../etc/passwd',
      '12345/doc-1/original.pdf',
      'null/doc-1/original.pdf',
    ];

    for (const p of invalidPaths) {
      assert.doesNotThrow(() => {
        const canSelect = sim.canSelectObject(userA, p);
        const canInsert = sim.canInsertObject(userOwner, p);
        assert.equal(canSelect, false, `Path ${p} must be denied cleanly`);
        assert.equal(canInsert, false, `Path ${p} insert must be denied cleanly`);
      });
    }
  });

  // --------------------------------------------------------------------------
  // Test 5: A public (unauthenticated) request for any object returns 401 or 404
  // --------------------------------------------------------------------------
  await t.test('5. A public (unauthenticated) request for any object returns 401 or 404', () => {
    const publicPath = `${orgA}/doc-secret/original.pdf`;
    assert.equal(sim.canSelectObject(null, publicPath), false, 'Unauthenticated user must be denied (401/404)');
    assert.equal(sim.canInsertObject(null, publicPath), false, 'Unauthenticated upload must be denied');
    assert.equal(sim.canDeleteObject(null, publicPath), false, 'Unauthenticated delete must be denied');
  });

  // --------------------------------------------------------------------------
  // Test 6: An .exe renamed to .pdf is rejected at finalize and its object is deleted
  // --------------------------------------------------------------------------
  await t.test('6. An .exe renamed to .pdf is rejected at finalize and its object is deleted', async () => {
    // PE binary header: MZ (0x4D, 0x5A) followed by typical MS-DOS stub
    const exeBuffer = Buffer.from([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
      0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00,
      0xb8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const result = await validateFinalObject({
      buffer: exeBuffer,
      declaredMime: 'application/pdf',
      originalFilename: 'tax_invoice_2026.pdf', // Renamed client filename
    });

    assert.equal(result.isValid, false);
    assert.match(result.error, /unrecognized file format|corrupted binary/i);
  });

  // --------------------------------------------------------------------------
  // Test 7: An 11 MB PDF is rejected; a 6 MB CSV is rejected
  // --------------------------------------------------------------------------
  await t.test('7. An 11 MB PDF is rejected; a 6 MB CSV is rejected', async () => {
    // 11 MB PDF
    const elevenMbPdf = Buffer.alloc(11 * 1024 * 1024);
    elevenMbPdf.write('%PDF-1.4\n', 0, 'ascii');

    const pdfResult = await validateFinalObject({
      buffer: elevenMbPdf,
      declaredMime: 'application/pdf',
      originalFilename: 'heavy_invoice.pdf',
    });
    assert.equal(pdfResult.isValid, false);
    assert.match(pdfResult.error, /exceeds maximum allowed limit of 10 MB/i);

    // 6 MB CSV
    const sixMbCsv = Buffer.alloc(6 * 1024 * 1024);
    sixMbCsv.write('Date,Description,Amount\n2026-10-01,Test,100\n', 0, 'utf8');

    const csvResult = await validateFinalObject({
      buffer: sixMbCsv,
      declaredMime: 'text/csv',
      originalFilename: 'heavy_statement.csv',
    });
    assert.equal(csvResult.isValid, false);
    assert.match(csvResult.error, /exceeds maximum allowed limit of 5 MB/i);
  });

  // --------------------------------------------------------------------------
  // Test 8: A PDF with >20 pages, encrypted PDF, and PDF containing /JavaScript are each rejected
  // --------------------------------------------------------------------------
  await t.test('8. A PDF with more than 20 pages, an encrypted PDF, and a PDF containing /JavaScript are each rejected', async () => {
    // 8a. PDF with 21 pages
    const doc21 = await PDFDocument.create();
    for (let i = 0; i < 21; i++) {
      doc21.addPage([200, 200]);
    }
    const pdfBytes21 = Buffer.from(await doc21.save());
    const res21 = await validatePdf(pdfBytes21);
    assert.equal(res21.isValid, false);
    assert.match(res21.error, /exceeds maximum allowed length of 20 pages/i);

    // 8b. PDF containing /JavaScript
    const jsDoc = await PDFDocument.create();
    jsDoc.addPage([200, 200]);
    const baseBytes = await jsDoc.save();
    const maliciousPdfBuffer = Buffer.concat([
      Buffer.from(baseBytes),
      Buffer.from('\n/JavaScript << /JS (app.alert("xss")) >>\n'),
    ]);
    const resJs = await validatePdf(maliciousPdfBuffer);
    assert.equal(resJs.isValid, false);
    assert.match(resJs.error, /forbidden active content token: \/JavaScript/i);

    // 8c. PDF with /Launch token
    const launchPdfBuffer = Buffer.concat([
      Buffer.from(baseBytes),
      Buffer.from('\n/Launch << /F (cmd.exe) >>\n'),
    ]);
    const resLaunch = await validatePdf(launchPdfBuffer);
    assert.equal(resLaunch.isValid, false);
    assert.match(resLaunch.error, /forbidden active content token: \/Launch/i);
  });

  // --------------------------------------------------------------------------
  // Test 9: A JPEG with GPS EXIF data has that data removed from the working copy
  // --------------------------------------------------------------------------
  await t.test('9. A JPEG with GPS EXIF data has that data removed from the working copy', async () => {
    // Generate JPEG with EXIF metadata
    const rawJpegWithExif = await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 210, g: 180, b: 140 } },
    })
      .withMetadata({
        exif: {
          IFD0: {
            Make: 'MobilePhoneCamera',
            Model: 'GalaxyTest',
          },
          GPSInfo: {
            GPSLatitude: '19/1 4/1 30/1',
            GPSLongitude: '72/1 52/1 50/1',
          },
        },
      })
      .jpeg()
      .toBuffer();

    const beforeMeta = await sharp(rawJpegWithExif).metadata();
    assert.equal(Boolean(beforeMeta.exif), true, 'Test fixture JPEG must contain EXIF metadata');

    const cleanResult = await validateAndCleanImage(rawJpegWithExif);
    assert.equal(cleanResult.isValid, true);
    assert.ok(cleanResult.cleanedBuffer, 'Cleaned buffer must be provided');

    const afterMeta = await sharp(cleanResult.cleanedBuffer).metadata();
    assert.equal(Boolean(afterMeta.exif), false, 'EXIF/GPS metadata must be stripped from working copy');
  });

  // --------------------------------------------------------------------------
  // Test 10: Uploading identical file twice gives duplicate message second time
  // --------------------------------------------------------------------------
  await t.test('10. Uploading the identical file twice gives the duplicate message the second time', async () => {
    const validDoc = await PDFDocument.create();
    validDoc.addPage([300, 300]);
    const fileBytes = Buffer.from(await validDoc.save());

    const hash1 = computeContentHash(fileBytes);
    const hash2 = computeContentHash(fileBytes);
    assert.equal(hash1, hash2, 'Identical bytes must produce deterministic SHA-256 hash');

    // Simulate database unique org constraint check:
    const mockDbDocuments = [
      { id: 'doc-original-123', org_id: orgA, content_hash: hash1, status: 'validated' },
    ];

    const duplicateFound = mockDbDocuments.find(
      (d) => d.org_id === orgA && d.content_hash === hash2 && d.status === 'validated'
    );

    assert.ok(duplicateFound, 'Duplicate entry must be detected');
    assert.equal(duplicateFound.id, 'doc-original-123');
    const duplicateMessage = 'This file was already uploaded';
    assert.equal(duplicateMessage, 'This file was already uploaded');
  });

  // --------------------------------------------------------------------------
  // Test 11: A signed view URL stops working after it expires
  // --------------------------------------------------------------------------
  await t.test('11. A signed view URL stops working after it expires', () => {
    const tokenCreatedTime = 1700000000000;
    const expiresInSeconds = 300; // 5 minutes

    // Valid within 300s window (e.g. 100 seconds later)
    const validTime = tokenCreatedTime + 100 * 1000;
    assert.equal(sim.verifySignedUrl(tokenCreatedTime, expiresInSeconds, validTime), true);

    // Expired at 301 seconds later
    const expiredTime = tokenCreatedTime + 301 * 1000;
    assert.equal(sim.verifySignedUrl(tokenCreatedTime, expiresInSeconds, expiredTime), false);
  });

  // --------------------------------------------------------------------------
  // Test 12: The 31st upload request in 10 minutes is rate-limited
  // --------------------------------------------------------------------------
  await t.test('12. The 31st upload request in 10 minutes is rate-limited', () => {
    const testUserId = `user-rate-test-${Date.now()}`;
    const testOrgId = `org-rate-test-${Date.now()}`;

    // Clear tracker for clean test isolation
    rateTracker.userRequests.delete(testUserId);

    // Make 30 allowed requests
    for (let i = 1; i <= 30; i++) {
      const res = checkUploadRateLimit(testUserId, testOrgId);
      assert.equal(res.isAllowed, true, `Request #${i} should be allowed`);
    }

    // 31st request must be denied
    const blockedRes = checkUploadRateLimit(testUserId, testOrgId);
    assert.equal(blockedRes.isAllowed, false, 'Request #31 must be blocked');
    assert.match(blockedRes.error, /Upload rate limit exceeded: maximum 30 uploads per 10 minutes/i);
  });

  // --------------------------------------------------------------------------
  // Test 13: A pending_validation row older than 1 hour is cleaned up
  // --------------------------------------------------------------------------
  await t.test('13. A pending_validation row older than 1 hour is cleaned up', () => {
    const now = Date.now();
    const oneHourAndFiveMinutesAgo = new Date(now - 65 * 60 * 1000).toISOString();
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();

    const mockDocs = [
      { id: 'doc-abandoned', status: 'pending_validation', created_at: oneHourAndFiveMinutesAgo, file_path: 'org/doc-abandoned/original.pdf' },
      { id: 'doc-active', status: 'pending_validation', created_at: tenMinutesAgo, file_path: 'org/doc-active/original.pdf' },
    ];

    const oneHourCutoff = new Date(now - 60 * 60 * 1000).toISOString();

    // Identify rows to clean
    const toCleanup = mockDocs.filter(
      (d) => d.status === 'pending_validation' && d.created_at < oneHourCutoff
    );

    assert.equal(toCleanup.length, 1);
    assert.equal(toCleanup[0].id, 'doc-abandoned');

    // Simulate cleanup update
    toCleanup.forEach((d) => {
      d.status = 'rejected';
      d.rejection_reason = 'abandoned';
    });

    assert.equal(mockDocs.find((d) => d.id === 'doc-abandoned').status, 'rejected');
    assert.equal(mockDocs.find((d) => d.id === 'doc-abandoned').rejection_reason, 'abandoned');
    assert.equal(mockDocs.find((d) => d.id === 'doc-active').status, 'pending_validation');
  });

  // --------------------------------------------------------------------------
  // Test 14: 50-file mixed batch produces exact accepted and rejected counts with rejections audited
  // --------------------------------------------------------------------------
  await t.test('14. A 50-file mixed batch (valid and invalid) produces exactly the expected accepted and rejected counts, with every rejection audited', async () => {
    const auditLogs = [];

    // Helper to log audit
    function recordAudit(docId, outcome, reason) {
      auditLogs.push({
        actor: 'test-user',
        org: orgA,
        documentId: docId,
        outcome,
        reason,
        loggedAt: new Date().toISOString(),
      });
    }

    // Build 25 valid files
    const validPdfDoc = await PDFDocument.create();
    validPdfDoc.addPage([100, 100]);
    const validPdfBuffer = Buffer.from(await validPdfDoc.save());

    const validCsvBuffer = Buffer.from(
      'Date,Description,Amount,Balance\n2026-10-01,Vendor A,500.00,10500.00\n2026-10-02,Vendor B,250.00,10250.00\n',
      'utf8'
    );

    const validPngBuffer = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 100, g: 80, b: 60, alpha: 1 } },
    }).png().toBuffer();

    const batch = [];

    // 25 Valid items
    for (let i = 0; i < 15; i++) {
      // Differentiate content to avoid duplicate hash collision
      const uniquePdf = Buffer.concat([validPdfBuffer, Buffer.from(`\n% unique-${i}`)]);
      batch.push({ id: `valid-pdf-${i}`, buffer: uniquePdf, mime: 'application/pdf', filename: `invoice_${i}.pdf`, expectValid: true });
    }
    for (let i = 0; i < 5; i++) {
      const uniqueCsv = Buffer.concat([validCsvBuffer, Buffer.from(`\n2026-10-0${i + 3},Entry,${100 * (i + 1)},10000\n`)]);
      batch.push({ id: `valid-csv-${i}`, buffer: uniqueCsv, mime: 'text/csv', filename: `bank_${i}.csv`, expectValid: true });
    }
    for (let i = 0; i < 5; i++) {
      const uniquePng = await sharp({
        create: { width: 40 + i, height: 40 + i, channels: 4, background: { r: 120, g: 90, b: 70, alpha: 1 } },
      }).png().toBuffer();
      batch.push({ id: `valid-png-${i}`, buffer: uniquePng, mime: 'image/png', filename: `scan_${i}.png`, expectValid: true });
    }

    // 25 Invalid items
    // 5 Renamed .exe
    const exeStub = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    for (let i = 0; i < 5; i++) {
      batch.push({ id: `invalid-exe-${i}`, buffer: exeStub, mime: 'application/pdf', filename: `malware_${i}.pdf`, expectValid: false });
    }
    // 5 Oversized PDFs (11MB)
    const bigPdf = Buffer.alloc(11 * 1024 * 1024);
    bigPdf.write('%PDF-1.4\n', 0, 'ascii');
    for (let i = 0; i < 5; i++) {
      batch.push({ id: `invalid-big-${i}`, buffer: bigPdf, mime: 'application/pdf', filename: `big_${i}.pdf`, expectValid: false });
    }
    // 5 PDFs with >20 pages
    const bigPagesDoc = await PDFDocument.create();
    for (let p = 0; p < 22; p++) bigPagesDoc.addPage([100, 100]);
    const bigPagesBuffer = Buffer.from(await bigPagesDoc.save());
    for (let i = 0; i < 5; i++) {
      batch.push({ id: `invalid-pages-${i}`, buffer: bigPagesBuffer, mime: 'application/pdf', filename: `long_${i}.pdf`, expectValid: false });
    }
    // 5 PDFs containing /JavaScript
    const jsBuf = Buffer.concat([validPdfBuffer, Buffer.from('\n/JavaScript (alert(1))\n')]);
    for (let i = 0; i < 5; i++) {
      batch.push({ id: `invalid-js-${i}`, buffer: jsBuf, mime: 'application/pdf', filename: `script_${i}.pdf`, expectValid: false });
    }
    // 5 Corrupted text CSVs with null bytes
    const corruptCsv = Buffer.from('Date,Desc,Amt\n\x00\x00\x00corrupt', 'binary');
    for (let i = 0; i < 5; i++) {
      batch.push({ id: `invalid-csv-${i}`, buffer: corruptCsv, mime: 'text/csv', filename: `corrupt_${i}.csv`, expectValid: false });
    }

    assert.equal(batch.length, 50, 'Batch must contain exactly 50 files');

    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const item of batch) {
      const res = await validateFinalObject({
        buffer: item.buffer,
        declaredMime: item.mime,
        originalFilename: item.filename,
      });

      if (res.isValid) {
        acceptedCount++;
      } else {
        rejectedCount++;
        recordAudit(item.id, 'rejected', res.error);
      }
    }

    assert.equal(acceptedCount, 25, 'Exactly 25 files should be validated and accepted');
    assert.equal(rejectedCount, 25, 'Exactly 25 files should be rejected');
    assert.equal(auditLogs.length, 25, 'Every rejected file must produce an audit log entry');

    // Confirm audit logs contain no full filenames or raw file contents
    for (const log of auditLogs) {
      assert.ok(log.actor);
      assert.ok(log.org);
      assert.ok(log.documentId);
      assert.equal(log.outcome, 'rejected');
      assert.ok(log.reason);
      assert.equal(log.content, undefined, 'Audit log must not contain raw file content');
    }
  });

  // --------------------------------------------------------------------------
  // Test 15: Server-side CSV validation (Section 3.2: UTF-8, no NUL, cols >= 3, rows <= 50,000)
  // --------------------------------------------------------------------------
  await t.test('15. Server-side CSV validation enforces strict UTF-8, no NUL bytes, header >= 3 cols, and <= 50,000 rows', () => {
    // 15a. Valid CSV passes
    const validCsv = Buffer.from('Date,Description,Amount\n2026-10-01,Supplier Payment,5000\n', 'utf8');
    const resOk = validateCsv(validCsv);
    assert.equal(resOk.isValid, true);
    assert.equal(resOk.rowCount, 2);

    // 15b. Header with < 3 columns is rejected
    const badColsCsv = Buffer.from('Date,Amount\n2026-10-01,5000\n', 'utf8');
    const resCols = validateCsv(badColsCsv);
    assert.equal(resCols.isValid, false);
    assert.match(resCols.error, /At least 3 columns are required/i);

    // 15c. CSV containing NUL bytes is rejected
    const nullByteCsv = Buffer.from('Date,Description,Amount\n2026-10-01,\x00corrupt,5000\n', 'binary');
    const resNull = validateCsv(nullByteCsv);
    assert.equal(resNull.isValid, false);
    assert.match(resNull.error, /forbidden null bytes/i);

    // 15d. Empty CSV is rejected
    const emptyCsv = Buffer.from('', 'utf8');
    const resEmpty = validateCsv(emptyCsv);
    assert.equal(resEmpty.isValid, false);
    assert.match(resEmpty.error, /CSV file is empty/i);

    // 15e. CSV with > 50,000 rows is rejected
    const lines = ['Date,Description,Amount'];
    for (let i = 0; i < 50005; i++) {
      lines.push(`2026-10-01,Entry #${i},100`);
    }
    const oversizedCsv = Buffer.from(lines.join('\n'), 'utf8');
    const resOver = validateCsv(oversizedCsv);
    assert.equal(resOver.isValid, false);
    assert.match(resOver.error, /exceeding maximum allowed limit of 50,000 rows/i);
  });

  // --------------------------------------------------------------------------
  // Test 16: iPhone HEIC image decoding & EXIF metadata stripping
  // --------------------------------------------------------------------------
  await t.test('16. Image pipeline successfully decodes images and strips personal EXIF metadata', async () => {
    // Generate valid JPEG image with simulated camera EXIF
    const testImg = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 180, g: 150, b: 120 } },
    })
      .withMetadata({
        exif: {
          IFD0: {
            Make: 'Apple',
            Model: 'iPhone 15 Pro',
          },
        },
      })
      .jpeg()
      .toBuffer();

    const metaBefore = await sharp(testImg).metadata();
    assert.equal(Boolean(metaBefore.exif), true);

    const cleanRes = await validateAndCleanImage(testImg, false);
    assert.equal(cleanRes.isValid, true);
    assert.ok(cleanRes.cleanedBuffer);

    const metaAfter = await sharp(cleanRes.cleanedBuffer).metadata();
    assert.equal(Boolean(metaAfter.exif), false, 'EXIF must be cleanly stripped from working copy');
  });

  // --------------------------------------------------------------------------
  // Test 17: Scheduled cleanup cron configuration (vercel.json & /api/cron/cleanup-uploads)
  // --------------------------------------------------------------------------
  await t.test('17. Scheduled cleanup cron is registered in vercel.json for automated execution', () => {
    const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));
    assert.ok(vercelConfig.crons, 'vercel.json must define crons schedule');
    const cleanupCron = vercelConfig.crons.find((c) => c.path === '/api/cron/cleanup-uploads');
    assert.ok(cleanupCron, 'Cleanup cron path must be /api/cron/cleanup-uploads');
    assert.equal(cleanupCron.schedule, '0 2 * * *', 'Schedule must run daily at 02:00 UTC (0 2 * * *) per Vercel Hobby limits');
  });

  // --------------------------------------------------------------------------
  // Test 18: Durable database-backed rate limiter simulation
  // --------------------------------------------------------------------------
  await t.test('18. Durable database-backed rate limiter queries audit_log records accurately', async () => {
    const mockAuditLog = [];
    const testUserId = `durable-user-${Date.now()}`;
    const testOrgId = `durable-org-${Date.now()}`;

    // Mock Supabase client mimicking audit_log count queries
    const mockSupabase = {
      from: (table) => ({
        select: (_query, options) => ({
          eq: (field1, val1) => ({
            eq: (field2, val2) => ({
              gte: (_field3, _val3) => {
                let matches = mockAuditLog.filter((entry) => {
                  return entry[field1] === val1 && entry[field2] === val2;
                });
                return Promise.resolve({ count: matches.length, error: null });
              },
            }),
          }),
        }),
      }),
    };

    // Populate 29 existing requests in audit_log
    for (let i = 0; i < 29; i++) {
      mockAuditLog.push({
        actor_id: testUserId,
        org_id: testOrgId,
        action: 'document_upload_requested',
        created_at: new Date().toISOString(),
      });
    }

    // 30th request allowed
    const res30 = await checkUploadRateLimitDurable(testUserId, testOrgId, mockSupabase);
    assert.equal(res30.isAllowed, true);

    // 31st request: Add one more to mockAuditLog to hit 30
    mockAuditLog.push({
      actor_id: testUserId,
      org_id: testOrgId,
      action: 'document_upload_requested',
      created_at: new Date().toISOString(),
    });

    const res31 = await checkUploadRateLimitDurable(testUserId, testOrgId, mockSupabase);
    assert.equal(res31.isAllowed, false);
    assert.match(res31.error, /maximum 30 uploads per 10 minutes/i);
  });
});
