/**
 * Galuxium Nexus V2: Core Relational Database Types & GST Fiscal Constraints
 */

export type UserRole = 'owner' | 'accountant' | 'viewer';
export type PlanTier = 'free' | 'pro' | 'enterprise';

export type DocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'extracting'
  | 'extracted'
  | 'validated'
  | 'failed';

export type MatchType = 'exact' | 'fuzzy_rule' | 'llm_assisted' | 'manual';
export type MatchStatus = 'auto_approved' | 'pending_review' | 'approved' | 'rejected';

export type FlagType =
  | 'duplicate_invoice'
  | 'gstin_invalid'
  | 'tax_mismatch'
  | 'date_outlier'
  | 'amount_mismatch'
  | 'split_payment';

export type Severity = 'info' | 'warning' | 'critical';

export type UsageEventType =
  | 'document_processed'
  | 'api_call'
  | 'llm_tokens'
  | 'storage_bytes';

/**
 * Standard Indian GST Statutory Validation Regexes
 */
export const GST_CONSTANTS = {
  // 15-character alphanumeric GSTIN format:
  // 2 digits state code + 5 chars PAN alpha + 4 digits PAN num + 1 char PAN alpha + 1 entity num + 'Z' + 1 checksum
  GSTIN_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  PAN_REGEX: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  HSN_SAC_REGEX: /^[0-9]{2,8}$/,
  VALID_GST_RATES: [0, 0.05, 0.12, 0.18, 0.28] as const,
};

export interface InvoiceLineItem {
  id: string;
  description: string;
  hsn_sac?: string;
  quantity?: number;
  unit_price?: number;
  taxable_amount: number;
  gst_rate: number; // e.g. 0.18 for 18%
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount: number;
}
