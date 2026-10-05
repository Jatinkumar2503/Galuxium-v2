import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  detectedMime?: string;
  detectedExt?: string;
  pageCount?: number;
  cleanedBuffer?: Buffer;
  contentHash?: string;
  sanitizedFilename?: string;
}

export const ALLOWED_MIME_TYPES = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  csv: 'text/csv',
} as const;

export const MAX_SIZE_BYTES = {
  invoice: 10 * 1024 * 1024, // 10 MB
  bankStatement: 5 * 1024 * 1024, // 5 MB
};

/**
 * Sanitizes a client-provided display filename.
 * Strips directory traversal (/ \ ..) and control characters. Caps at 120 chars.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'document';
  // Remove directory separators and null/control bytes
  let cleaned = filename.replace(/[/\\]/g, '_').replace(/[\x00-\x1f\x7f]/g, '');
  // Remove traversal patterns
  cleaned = cleaned.replace(/\.\./g, '_').trim();
  if (cleaned.length > 120) {
    const extMatch = cleaned.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[0] : '';
    cleaned = cleaned.slice(0, 120 - ext.length) + ext;
  }
  return cleaned || 'document';
}

/**
 * Detects file type from magic bytes (Section 3.2).
 */
export function detectTypeFromMagicBytes(buffer: Buffer): { mime: string; ext: string } | null {
  if (!buffer || buffer.length < 4) return null;

  // 1. PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  // 2. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // 3. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // 4. HEIC / HEIF: bytes 4 to 7 are 'ftyp', bytes 8 to 11 match brand
  if (buffer.length >= 12) {
    const ftyp = buffer.subarray(4, 8).toString('latin1');
    if (ftyp === 'ftyp') {
      const brand = buffer.subarray(8, 12).toString('latin1').toLowerCase();
      if (['heic', 'heix', 'hevc', 'mif1', 'heif'].includes(brand)) {
        return { mime: 'image/heic', ext: 'heic' };
      }
    }
  }

  // 5. CSV check: UTF-8 valid, no NUL bytes, >= 3 columns in header, <= 50,000 rows
  try {
    const text = buffer.toString('utf8');
    if (!buffer.includes(0x00)) {
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const header = lines[0];
        const cols = header.split(/[,\t;|]/);
        if (cols.length >= 3 && lines.length <= 50000) {
          return { mime: 'text/csv', ext: 'csv' };
        }
      }
    }
  } catch {
    // Non-text
  }

  return null;
}

/**
 * Validates a PDF file against security constraints (Section 3.4).
 */
export async function validatePdf(
  buffer: Buffer
): Promise<{ isValid: boolean; error?: string; pageCount?: number }> {
  // Heuristic token scan for dangerous elements
  const rawString = buffer.toString('latin1');
  const forbiddenTokens = ['/JavaScript', '/JS', '/Launch', '/EmbeddedFile'];
  for (const token of forbiddenTokens) {
    if (rawString.includes(token)) {
      return {
        isValid: false,
        error: `PDF contains forbidden active content token: ${token}`,
      };
    }
  }

  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
    });

    if (pdfDoc.isEncrypted) {
      return {
        isValid: false,
        error: 'Encrypted or password-protected PDFs are not supported.',
      };
    }

    const pageCount = pdfDoc.getPageCount();
    if (pageCount > 20) {
      return {
        isValid: false,
        error: `PDF exceeds maximum allowed length of 20 pages (found ${pageCount} pages).`,
        pageCount,
      };
    }

    return {
      isValid: true,
      pageCount,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('encrypt')) {
      return {
        isValid: false,
        error: 'Encrypted or password-protected PDFs are not supported.',
      };
    }
    return {
      isValid: false,
      error: `Invalid or malformed PDF structure: ${msg}`,
    };
  }
}

/**
 * Validates an image file, guards against decompression bombs, and strips EXIF/GPS (Section 3.5).
 */
export async function validateAndCleanImage(
  buffer: Buffer
): Promise<{ isValid: boolean; error?: string; cleanedBuffer?: Buffer }> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return { isValid: false, error: 'Could not decode image dimensions.' };
    }

    // Decompression-bomb guard: reject images over 8000x8000 or > 40 megapixels
    const megaPixels = (metadata.width * metadata.height) / 1_000_000;
    if (metadata.width > 8000 || metadata.height > 8000 || megaPixels > 40) {
      return {
        isValid: false,
        error: `Image dimensions (${metadata.width}x${metadata.height}, ${megaPixels.toFixed(1)} MP) exceed the 40 MP safety threshold.`,
      };
    }

    // Auto-orient and strip all EXIF/GPS metadata from the working copy
    const cleaned = await sharp(buffer)
      .rotate() // auto-orient based on EXIF before stripping
      .toBuffer(); // Sharp strips all EXIF/GPS/IPTC metadata by default unless withMetadata is called

    return {
      isValid: true,
      cleanedBuffer: cleaned,
    };
  } catch (err: unknown) {
    return {
      isValid: false,
      error: `Image processing error: ${err instanceof Error ? err.message : 'Corrupt image'}`,
    };
  }
}

/**
 * Computes SHA-256 content hash.
 */
export function computeContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Complete finalize validation pipeline (Section 3: in order, stop at first failure).
 */
export async function validateFinalObject(params: {
  buffer: Buffer;
  declaredMime: string;
  originalFilename: string;
}): Promise<FileValidationResult> {
  const { buffer, declaredMime, originalFilename } = params;

  // 1. Size check
  const isCsv = declaredMime === 'text/csv';
  const maxSize = isCsv ? MAX_SIZE_BYTES.bankStatement : MAX_SIZE_BYTES.invoice;
  if (buffer.length > maxSize) {
    const maxMb = maxSize / (1024 * 1024);
    return {
      isValid: false,
      error: `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${maxMb} MB.`,
    };
  }

  // 2. Magic bytes verification (read first 16 bytes, ignore client declared type/ext)
  const detected = detectTypeFromMagicBytes(buffer);
  if (!detected) {
    return {
      isValid: false,
      error: 'Unrecognized file format or corrupted binary data. Allowed formats: PDF, JPEG, PNG, HEIC, CSV.',
    };
  }

  // 3. Declared vs detected type must match
  if (detected.mime !== declaredMime) {
    return {
      isValid: false,
      error: `Type mismatch: declared as "${declaredMime}", but file magic bytes identify it as "${detected.mime}".`,
    };
  }

  let pageCount: number | undefined;
  let cleanedBuffer = buffer;

  // 4. PDF specific checks
  if (detected.mime === 'application/pdf') {
    const pdfRes = await validatePdf(buffer);
    if (!pdfRes.isValid) {
      return {
        isValid: false,
        error: pdfRes.error,
      };
    }
    pageCount = pdfRes.pageCount;
  }

  // 5. Image specific checks (JPEG, PNG, HEIC)
  if (['image/jpeg', 'image/png', 'image/heic'].includes(detected.mime)) {
    const imgRes = await validateAndCleanImage(buffer);
    if (!imgRes.isValid) {
      return {
        isValid: false,
        error: imgRes.error,
      };
    }
    if (imgRes.cleanedBuffer) {
      cleanedBuffer = imgRes.cleanedBuffer;
    }
  }

  // 6. Compute SHA-256 hash of original bytes
  const contentHash = computeContentHash(buffer);

  // 7. Sanitize filename
  const sanitizedFilename = sanitizeFilename(originalFilename);

  return {
    isValid: true,
    detectedMime: detected.mime,
    detectedExt: detected.ext,
    pageCount,
    cleanedBuffer,
    contentHash,
    sanitizedFilename,
  };
}
