import { z } from 'zod';

/**
 * Parses any Indian or international currency string into integer paise.
 * Examples:
 *   "1,23,456.78" -> 12345678
 *   "Rs. 1,53,400.00" -> 15340000
 *   "₹ 85,000" -> 8500000
 *   153400 -> 15340000 (if treated as rupee float) or preserved
 */
export function parseIndianAmountToPaise(val: unknown): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 0;
    // If it's already an integer, check whether it was sent as float Rupees or paise
    // In our Zod transformations, inputs from models are usually Rupee amounts (e.g. 153400.00)
    return Math.round(val * 100);
  }

  if (typeof val === 'string') {
    // Strip symbols, commas, and currency labels
    const cleaned = val
      .replace(/[₹$€£]/g, '')
      .replace(/Rs\.?/gi, '')
      .replace(/INR/gi, '')
      .replace(/,/g, '')
      .trim();

    const parsedFloat = parseFloat(cleaned);
    if (isNaN(parsedFloat) || !Number.isFinite(parsedFloat)) {
      return 0;
    }
    return Math.round(parsedFloat * 100);
  }

  return 0;
}

/**
 * Normalizes common invoice date formats to ISO YYYY-MM-DD.
 */
export function normalizeIsoDate(val: unknown): string {
  if (typeof val !== 'string' || !val.trim()) {
    return new Date().toISOString().split('T')[0];
  }

  const trimmed = val.trim();

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Attempt standard Date parsing (e.g. "10-Oct-2026")
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return trimmed;
}

// Line Item Schema
export const LineItemSchema = z.object({
  description: z.string().default('Item Description'),
  hsn_sac: z.string().optional(),
  quantity: z.coerce.number().default(1),
  unit: z.string().optional(),
  rate: z.preprocess(parseIndianAmountToPaise, z.number().int()), // integer paise
  taxable_amount: z.preprocess(parseIndianAmountToPaise, z.number().int()), // integer paise
  tax_rate: z.coerce.number().default(0.18), // decimal (0.18 for 18%)
  cgst: z.preprocess(parseIndianAmountToPaise, z.number().int().default(0)), // integer paise
  sgst: z.preprocess(parseIndianAmountToPaise, z.number().int().default(0)), // integer paise
  igst: z.preprocess(parseIndianAmountToPaise, z.number().int().default(0)), // integer paise
  total: z.preprocess(parseIndianAmountToPaise, z.number().int()), // integer paise
});

// Party Schema (Supplier / Buyer)
export const PartySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  gstin: z.string().optional(),
  address: z.string().optional(),
  state_code: z.string().optional(),
});

// Totals Schema
export const TotalsSchema = z.object({
  subtotal: z.preprocess(parseIndianAmountToPaise, z.number().int()), // integer paise
  cgst: z.preprocess(parseIndianAmountToPaise, z.number().int().default(0)), // integer paise
  sgst: z.preprocess(parseIndianAmountToPaise, z.number().int().default(0)), // integer paise
  igst: z.preprocess(parseIndianAmountToPaise, z.number().int().default(0)), // integer paise
  cess: z.preprocess(parseIndianAmountToPaise, z.number().int().default(0)), // integer paise
  round_off: z.preprocess(parseIndianAmountToPaise, z.number().int().default(0)), // integer paise
  grand_total: z.preprocess(parseIndianAmountToPaise, z.number().int()), // integer paise
});

// Master Invoice Extraction Schema (Phase 6.2)
export const InvoiceExtractionSchema = z.object({
  document_type: z
    .enum(['tax_invoice', 'credit_note', 'debit_note', 'receipt', 'other'])
    .default('tax_invoice'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.preprocess(normalizeIsoDate, z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  due_date: z.preprocess(
    (v) => (v ? normalizeIsoDate(v) : undefined),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  ),
  currency: z.string().default('INR'),

  supplier: PartySchema,
  buyer: PartySchema.partial().optional(),
  place_of_supply: z.string().optional(),

  line_items: z.array(LineItemSchema).default([]),
  totals: TotalsSchema,

  field_confidences: z.record(z.string(), z.number()).default({}),
  suspicious_content_detected: z.boolean().default(false),
});

export type InvoiceExtractionData = z.infer<typeof InvoiceExtractionSchema>;
export type LineItemData = z.infer<typeof LineItemSchema>;
export type TotalsData = z.infer<typeof TotalsSchema>;
