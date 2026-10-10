/**
 * PII Handling and Sanitization Module (Phase 6.7)
 * Ensures personal phone numbers, emails, bank accounts, and UPI IDs
 * are strictly redacted before logging or storing in free text.
 * Preserves business identifiers (GSTIN, invoice numbers, legal business names).
 */

// Regex patterns for sensitive PII
const PII_PATTERNS = {
  // Personal Email addresses (e.g. user@domain.com)
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // UPI IDs (e.g. 9876543210@ybl, name@okhdfcbank, name@upi)
  upi: /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g,

  // Indian phone numbers: +91 followed by 10 digits, or standalone 10-digit mobiles starting with 6-9
  phone: /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g,

  // Bank account numbers (standalone 9 to 18 consecutive digits)
  // Avoids matching 15-character GSTINs (which contain alphanumeric characters)
  bankAccount: /\b(?<![A-Z0-9])\d{9,18}(?![A-Z0-9])\b/g,
};

/**
 * Redacts personal sensitive data from any string or log message.
 */
export function redactPii(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;

  // Redact Emails first
  cleaned = cleaned.replace(PII_PATTERNS.email, '[REDACTED_EMAIL]');

  // Redact UPI IDs (if any remain that didn't match standard email)
  cleaned = cleaned.replace(PII_PATTERNS.upi, '[REDACTED_UPI]');

  // Redact Phone numbers
  cleaned = cleaned.replace(PII_PATTERNS.phone, '[REDACTED_PHONE]');

  // Redact Bank account numbers
  cleaned = cleaned.replace(PII_PATTERNS.bankAccount, '[REDACTED_ACCOUNT]');

  return cleaned;
}

/**
 * Recursively redacts PII from objects, arrays, and strings before passing to logs or Sentry.
 */
export function sanitizeLogData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return redactPii(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeLogData(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      // Disallow raw document text, prompts, or base64 blobs in logs
      if (
        /^(raw_text|document_text|base64|file_content|prompt|model_response|raw_response)$/i.test(
          key
        )
      ) {
        sanitizedObj[key] = '[OMITTED_FOR_PRIVACY]';
      } else {
        sanitizedObj[key] = sanitizeLogData(value);
      }
    }
    return sanitizedObj as T;
  }

  return input;
}
