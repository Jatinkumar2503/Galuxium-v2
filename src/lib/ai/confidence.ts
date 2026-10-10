import type { VerificationIssue } from './verification.ts';

/**
 * Extraction Confidence & Review Heuristic Engine (Phase 6.5)
 *
 * Implements calibrated composite confidence scoring combining
 * model-reported signals with statutory deterministic rule verification.
 */

export const NEEDS_REVIEW_THRESHOLD = 0.85;

export interface ConfidenceEvaluation {
  fieldConfidences: Record<string, number>;
  overallConfidence: number;
  needsReview: boolean;
}

/**
 * Calculates field and overall confidence with deterministic check penalties.
 *
 * @param modelConfidences Raw 0-1 confidence scores reported by AI model
 * @param issues Deterministic verification issues from check suite
 */
export function evaluateConfidence(
  modelConfidences: Record<string, number> = {},
  issues: VerificationIssue[] = []
): ConfidenceEvaluation {
  const adjustedFieldConfidences: Record<string, number> = {};

  // Build map of failing fields by severity
  const fieldFailures = new Set<string>();
  let hasHardError = false;

  for (const issue of issues) {
    if (issue.severity === 'error') {
      hasHardError = true;
      fieldFailures.add(issue.field);
      // Also mark parent field (e.g. 'supplier.gstin' -> 'supplier_gstin')
      if (issue.field.includes('.')) {
        fieldFailures.add(issue.field.replace('.', '_'));
      }
    }
  }

  // Key statutory fields that anchor overall confidence
  const keyFieldKeys = [
    'invoice_number',
    'invoice_date',
    'supplier_gstin',
    'grand_total',
    'tax_totals',
  ];

  // Adjust each field confidence: if a deterministic check fails on it, penalize by * 0.5
  for (const [field, rawScore] of Object.entries(modelConfidences)) {
    const isFailing =
      fieldFailures.has(field) ||
      fieldFailures.has(`totals.${field}`) ||
      fieldFailures.has(`supplier.${field}`);

    const baseScore = typeof rawScore === 'number' && !isNaN(rawScore) ? Math.max(0, Math.min(1, rawScore)) : 0.8;
    adjustedFieldConfidences[field] = isFailing ? Math.round(baseScore * 0.5 * 100) / 100 : baseScore;
  }

  // Ensure all key fields have a calculated score
  for (const key of keyFieldKeys) {
    if (adjustedFieldConfidences[key] === undefined) {
      const isFailing = fieldFailures.has(key);
      adjustedFieldConfidences[key] = isFailing ? 0.4 : 0.9;
    }
  }

  // Overall confidence = minimum of the key fields
  const keyScores = keyFieldKeys.map((k) => adjustedFieldConfidences[k]);
  let minKeyScore = Math.min(...keyScores);

  // If any hard check failed across the document, cap overall confidence at 0.5
  if (hasHardError && minKeyScore > 0.5) {
    minKeyScore = 0.5;
  }

  const overallConfidence = Math.round(minKeyScore * 100) / 100;
  const needsReview = overallConfidence < NEEDS_REVIEW_THRESHOLD;

  return {
    fieldConfidences: adjustedFieldConfidences,
    overallConfidence,
    needsReview,
  };
}
